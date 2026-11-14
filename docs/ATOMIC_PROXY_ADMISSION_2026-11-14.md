# Atomic prepaid model-call admission

## Release steps

1. Apply the entire `supabase/migrations/044_blue_atomic_proxy_admission.sql` in
   the production Supabase SQL Editor. This is additive, retains the legacy RPC
   signatures, existing balances, task holds and permanent ledger. It assumes
   the existing 039 and 041 migrations are already installed. No data backfill
   outside the current account rate window is required.
2. Confirm installation with:

   ```sql
   select to_regprocedure('public.admit_blue_proxy_call_v2(uuid,text,text,text,uuid,text,uuid,jsonb)') as admission_rpc,
          to_regprocedure('public.release_blue_proxy_admission(uuid,text,uuid,uuid)') as recovery_rpc;
   ```

   Both values must be non-null. The migration reloads PostgREST's schema cache.
3. Push these prepared Portal files and wait for Vercel to finish. The same shared
   implementation serves the Vercel fallback and the Cloudflare Worker. No new
   secrets or required Vercel variables are needed. Keep the existing six proxy
   settings for old-call cleanup and compatibility. The Worker URL is unchanged:
   `https://blue-inference-proxy.blue-inference-worker.workers.dev/v1`.
4. Test one normal prepaid task, parallel Teams specialists, an image task and
   Stop/refund. New calls should appear as `admission_version=2` and
   `redis_hold_required=false`. Check actual settlements and final wallet refund.
   Direct BYOK does not use this path. No Desktop rebuild/restart is required.

   ```sql
   select admission_version, redis_hold_required, state, count(*)
   from public.blue_proxy_calls
   where created_at > now() - interval '15 minutes'
   group by admission_version, redis_hold_required, state;
   ```

## Rollout behavior

The deployed configuration is `BLUE_PROXY_ATOMIC_ADMISSION=auto`. The proxy tries
the atomic RPC. It uses legacy admission only on an exact HTTP 404 / PGRST202
missing-function response for `admit_blue_proxy_call_v2`, which guarantees no
admission transaction was executed. Timeouts, connection failures and other
database errors never trigger fallback or a second dispatch. Once 044 is applied,
the Worker uses atomic admission without another deploy. A missing migration
temporarily retains the old Redis command usage; apply 044 to enable the saving.

Optional `required` mode refuses legacy fallback; `legacy` is an operator rollback
switch. No ticket/credential protocol changes are necessary. Do not drop 044 to
roll back: old and new callers can coexist safely. Existing calls admitted by an
old Worker may still use their Redis release outbox. Keep its credentials.

## What changed

- The Worker prepares a normalized request and a pricing quote from the current
  server-verified model catalogue. No prompt or output is passed to the RPC.
- One `admit_blue_proxy_call_v2` transaction validates the task/account/device,
  expiry, model and purpose; checks duplicate identity and concurrency; clamps
  affordable output tokens; reserves the cost; records dispatch intent.
- A server-generated attempt UUID binds recovery to the exact Worker attempt.
  Desktop cannot supply it. Duplicate HTTP attempts cannot release each other's
  reservations. An admission response lost before upstream fetch may be released
  only by its owner. There is no blind admission/HTTP replay.
- A BEFORE INSERT trigger shares one 120-requests-per-minute account window
  between legacy and new admissions. There is one bounded row per account, not
  one row per model step. The migration seeds the current legacy window so the
  rollout cannot grant a fresh second quota. Existing legacy Redis checks may be
  temporarily more conservative, but cannot double the PostgreSQL limit.
- Existing task locks enforce eight active calls and prevent parallel specialists
  from reserving the same allowance. No database transaction stays open during
  upstream streaming. Images retain the full remaining task hold; paid/free
  restrictions and provider price ceilings remain enforced.
- New calls have an explicit no-Redis marker and an already-acknowledged cleanup
  timestamp. Their admission, SSE events, settlement and later reconciliation
  issue **zero Redis commands**. Legacy holds keep their existing cleanup path.
- Actual upstream usage still settles idempotently in PostgreSQL. Stop blocks
  new admissions; an already admitted call may incur cost. Unknown upstream
  outcomes retain their reservation; they are not silently refunded as free.

## Exact round trips and remaining limits

The healthy pre-dispatch path goes from three Supabase RPCs to **one**. A normal
response then uses one settlement RPC. When a provider generation ID appears,
one early observation RPC persists it for crash recovery (not one per chunk).
Timeout recovery and later reconciliation can require additional database calls.
There are no in-memory spending counters and no Durable Objects deployment.

A SQL commit and an external HTTP request cannot form one atomic transaction.
If a Worker crashes after admission or an upstream outcome is uncertain and no
generation ID was recorded, the hold stays pending for operator reconciliation.
This prevents unsafe reuse of possibly spent credit, at the cost of delayed
availability in that exceptional case. This release does not claim to eliminate
provider errors, guarantee exact token estimates, or prove Supabase Free capacity.

## Verification commands

From the Portal root:

```powershell
node --experimental-strip-types --test lib/blueAtomicAdmission.test.mjs lib/blueAtomicAdmissionLedger.test.cjs lib/blueTaskProxy.test.cjs lib/blueTaskProxyLedger.test.cjs lib/blueProxyCleanup.test.mjs lib/blueControlRateLimit.test.mjs lib/websiteRedisIsolation.test.mjs lib/blueRuntimeContracts.test.mjs lib/usageAccounting.test.mjs
npm run build
Set-Location edge
npm test
npm run verify -- https://blue-inference-proxy.blue-inference-worker.workers.dev/v1
```

SQL tests execute the actual migration against isolated PostgreSQL-compatible
PGlite, including 80 synthetic accounts with 20 calls each. That validates
accounting and contention behavior in a single-process test, not hosted Supabase
network latency or 80-user production performance. The compiled Worker tests run
in real local workerd with synthetic upstream/database responses. Live health
checks do not submit paid inference or prove production SQL installation.

## Verified release state — 2026-11-14

- Portal production build, lint and type checks passed (73 generated pages).
- 88 focused regression tests passed, plus all 3 compiled workerd runtime tests.
- The actual shared proxy was exercised against the migrated isolated SQL;
  admission, clamped dispatch, settlement and wallet refund passed without Redis.
- Synthetic load: 1,600 calls across 80 test accounts completed with exact totals.
  The minute-boundary test assertion was corrected to count durable calls instead
  of assuming a test cannot cross a real clock minute; rollover is also tested.
- Deployed Worker version: `e11a3857-5667-43bf-9a12-6311fd13a4bf`.
- Previous Worker version for rollback: `73aff008-88a5-4ac0-8286-745e4afc42b6`.
- Live health returned ready, admission protocol 2 and mode `auto`; a request
  without a ticket was rejected. No paid inference was submitted.
- Supabase migration and Portal push/deployment remain for the owner to perform.