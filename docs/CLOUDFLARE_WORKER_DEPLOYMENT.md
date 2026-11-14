# Cloudflare primary inference proxy

> Updated 2026-11-14: apply migration 044 for one atomic pre-dispatch RPC and
> zero Redis commands on new model calls. See [atomic admission rollout](ATOMIC_PROXY_ADMISSION_2026-11-14.md).
> Redis instructions below remain relevant to legacy calls and rollback.

The website/account API stays on Vercel. Only prepaid inference streams move to
Cloudflare. Supabase remains the permanent ledger; Upstash remains the hold gate.
BYOK still calls the user's provider directly. Apply migrations 038, 039 and
041 before deploying the optimized proxy/Portal. See
REDIS_COMMAND_AUDIT_2026-11-13.md for exact command counts and update order.

Public DNS currently places imergene.in on Vercel nameservers. Start with the
Worker's workers.dev address; do not move website DNS or add an arbitrary CNAME.
The Worker name must stay `blue-inference-proxy`, which the clients explicitly
trust. Its URL will be `https://blue-inference-proxy.YOUR-SUBDOMAIN.workers.dev`.
YOUR-SUBDOMAIN is supplied by your Cloudflare account, not your Vercel team name.

## 1. Install and log in (PowerShell)

```powershell
Set-Location 'C:\Users\ASUS\Desktop\blue-portal\edge'
npm ci
npx wrangler login
npx wrangler whoami
npm run check
```

Wrangler is pinned to 4.161.0. Complete login in your browser and select the
correct Cloudflare account if prompted. If you have several accounts, set
`$env:CLOUDFLARE_ACCOUNT_ID = 'YOUR_ACCOUNT_ID'` in this terminal first.
If Cloudflare asks you to choose a workers.dev subdomain, choose one and finish
that setup. No Cloudflare API token needs to be copied into Blue or Vercel.

## 2. Create the Worker, then upload secrets

```powershell
npx wrangler deploy
npm run secrets
```

The first deploy creates the Worker and prints its workers.dev URL. Until all
secrets are present its health endpoint returns 503 and inference stays blocked.
The upload helper prompts for these SIX exact existing Vercel Production values:

| Cloudflare secret | Value to paste |
| --- | --- |
| BLUE_TASK_TICKET_SECRET | Exactly the SAME ticket secret as Vercel |
| OPENROUTER_API_KEY | Your server inference key |
| NEXT_PUBLIC_SUPABASE_URL | Your existing Supabase HTTPS project URL |
| SUPABASE_SERVICE_ROLE_KEY | Your existing server-only Supabase service-role key |
| UPSTASH_REDIS_REST_URL | Your existing Redis HTTPS REST URL |
| UPSTASH_REDIS_REST_TOKEN | Your existing standard read/write REST token |

On Windows the helper opens a form with six masked fields and Paste buttons.
On other platforms it prompts in the terminal with input hidden. Paste each raw
value without quotes. The helper sends
only these names to Wrangler through stdin. It does not save a secret file or
print values. Do not use `vercel env pull` to upload all Portal secrets wholesale.

You do NOT upload OPENROUTER_MANAGEMENT_API_KEY, OPENROUTER_WORKSPACE_ID, Blue
user API keys, database passwords or payment/email credentials to this Worker.
Its own proxy URL is derived from its assigned request hostname, so the Worker
does not need BLUE_RUNTIME_PROXY_BASE_URL. The 900000-ms model-turn limit is a
non-secret Wrangler setting, and production/preview request logging is disabled.

To enter secrets individually instead of the helper:

```powershell
npx wrangler secret put BLUE_TASK_TICKET_SECRET
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

Each command prompts for its value. Use either the helper or individual commands.
Secret updates deploy immediately to an existing Worker. Existing secrets are
preserved by later code-only `wrangler deploy` calls.

## 3. Final deploy and configuration/authentication check

```powershell
npx wrangler deploy
$blueWorkerBase = 'https://blue-inference-proxy.YOUR-SUBDOMAIN.workers.dev/v1'
npm run verify -- $blueWorkerBase
```

Replace YOUR-SUBDOMAIN with the actual address printed by Wrangler. Verification
checks configured health and rejects a request without a ticket; it does not
send paid inference and does not prove Redis/Postgres permissions or paid billing.

## 4. Switch Vercel, then push Portal

In blue-portal's Vercel Production environment, set:

```dotenv
BLUE_RUNTIME_PROXY_BASE_URL=https://blue-inference-proxy.YOUR-SUBDOMAIN.workers.dev/v1
BLUE_RUNTIME_PROXY_FALLBACK_ENABLED=true
```

Keep all existing Vercel secrets, including the same six above, because ticket
issuance, settlement and the Vercel fallback still need them. Push the prepared
Portal files and wait for deployment. Check `/api/runtime/v1/health`: it must
report protocol 2 and the Worker URL as primary_proxy_base_url. Use the updated
Desktop/extension build: older builds do not trust workers.dev endpoints.

Portal probes Worker readiness before issuing/renewing a ticket, sharing a
15-second cache among callers. If the Worker is unready, it issues a SEPARATE
ticket for the existing Vercel proxy audience. Relays can change the trusted
endpoint before dispatch while keeping the same task/model and warm engine.
There is NO cross-host replay after a paid POST, partial response or ambiguous
network failure. Already-issued tickets retain their host until safely renewed.
The same database call IDs and reservations remain authoritative on both hosts.

Test one paid ordinary task, a Teams lead and specialist, image generation,
ticket renewal, Stop/refund and a BYOK task. Inspect final ledger/hold settlement
before making the client release public. A build or health check alone does not
prove the complete production path.

## Rollback / fallback

For a controlled rollback, change Vercel BLUE_RUNTIME_PROXY_BASE_URL back to
`https://blue-by-imergene.vercel.app/api/runtime/proxy/v1` and redeploy Portal.
New/renewed tickets then use Vercel. Do not replay uncertain paid calls manually.
To prohibit Vercel fallback entirely, set BLUE_RUNTIME_PROXY_FALLBACK_ENABLED=false.

## Cost and limits

This configuration does not buy a paid plan or enable a subscription. For live
production, evaluate Workers Paid: Workers Free has a small per-request CPU
allowance, which may be insufficient for large prompts, JSON parsing and stream
usage processing. A long-lived stream is not permission to exceed CPU limits.
See https://developers.cloudflare.com/workers/platform/pricing/ and
https://developers.cloudflare.com/workers/platform/limits/ for current terms.

## Existing account-summary warning

The live RPC check returned PGRST202: public.blue_usage_summary was not found in
the Supabase schema cache. Apply `040_restore_blue_usage_summary.sql` manually in
Supabase SQL Editor. It restores ONLY the aggregate function, restricts it to
service_role and asks PostgREST to refresh its cache. It does not modify balances,
payments or the proxy. The `payments:false, usage:false, summary:true` warning
means only the summary query failed; false flags represent successful queries.
