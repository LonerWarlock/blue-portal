# Blue prepaid task proxy

Prepaid Blue Credits now use protocol 2. Desktop and the extension receive a
ten-minute signed Blue ticket, scoped to one user, device binding, task and exact
model routes. OpenRouter inference credentials never leave the server. A ticket
can still be copied from a compromised computer, but only authorizes that user's
bounded task through Blue's authenticated proxy. It cannot authenticate with
OpenRouter. BYOK continues to send the user's own key directly to OpenRouter.

## Before pushing Portal

This is a coordinated client/backend update. Installed protocol-1 clients cannot
start prepaid tasks after the protocol-2 backend is deployed. They receive an
update-required error; there is no fallback that returns provider credentials.
Prepare and distribute the matching Desktop and extension releases. BYOK is
independent. Existing legacy tasks retain their original billing and key cleanup
until they finish or expire; new child keys are never created by this path.

1. Apply `supabase/migrations/039_blue_task_ticket_proxy.sql` in Supabase.
   It adds per-call reservations and an append-only financial event ledger.
   Tasks admitted by the old backend remain legacy until they finish; only the
   new v5 admission selects ticket transport. Applying SQL before the code push
   therefore does not change the old backend's credential or settlement path.
2. Configure the variables below in the intended deployment environment.
3. Push Portal, check `/api/runtime/v1/health`, then test with an updated client.
4. Verify a paid normal task, parallel Teams specialists, cancellation, one image,
   ticket renewal and a BYOK task. Observe the final ledger and wallet refund.
5. Publish the coordinated client releases. Do not describe a local test or a
   successful build as proof that the remote production deployment passed.

Required existing variables:

- `OPENROUTER_API_KEY`: inference service key, held only by the proxy.
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: a writable Redis REST
  credential. Missing Redis blocks prepaid model dispatch; it never fails open.

New variables:

- `BLUE_TASK_TICKET_SECRET`: a new random secret with at least 32 bytes of entropy.
  Generate it locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
  and paste it into Vercel. Do not commit it or send it to Desktop.
- `BLUE_RUNTIME_PROXY_BASE_URL`:
  `https://blue-by-imergene.vercel.app/api/runtime/proxy/v1` for the existing
  Vercel deployment, or `https://models.blue.imergene.in/v1` for the Worker below.

The supplied screenshot has `OPENROUTER_WORKSPACE_ID`, which is an identifier,
not another API key. Keep it and `OPENROUTER_MANAGEMENT_API_KEY` during legacy
credential cleanup. New task authorization does not use the management API.

## Cloudflare primary and Vercel fallback

Follow `docs/CLOUDFLARE_WORKER_DEPLOYMENT.md` for the ready-to-deploy workers.dev
configuration, six-secret upload, and Vercel endpoint switch. The website stays
on Vercel. Portal selects a ready Worker first and issues a separate Vercel ticket
only before inference dispatch. Ambiguous paid POSTs are never replayed.

The Vercel proxy uses Node serverless execution with a 300-second maximum so
buffered image/JSON requests can wait for their model. Streaming requests return
an early SSE comment and periodic keepalives while the upstream model responds.
The per-turn safety timeout is 270 seconds; a task can contain many turns.

`edge/blue-proxy-worker.mjs` imports the same Web-API-only modules and supplies
Cloudflare's `waitUntil` for cleanup. Its base URL comes from its assigned request
host; Vercel's base URL setting points at that Worker. Vercel variables do not
automatically reach Workers. Ticket signing and all backing-service credentials
must match. The Worker has a 15-minute per-turn wall-time limit. The Vercel fallback
retains its 270-second per-turn bound. No DNS change is required for workers.dev.

## Credit accounting

Postgres remains authoritative for money. The existing wallet transaction creates
one task reservation and retains Teams purchase entitlements and the agreed
credit multiplier. Each model call then obtains an atomic Postgres reservation
within that task and a Redis hold/concurrency gate before provider dispatch.
Redis holds are for the already-funded task allowance, not a second wallet.
Deleting Redis state cannot mint credit or bypass the Postgres check.

Only server-observed upstream usage is accepted for settlement. Desktop usage
and generation IDs are hints for display and never proof for prepaid charging.
Call IDs and database locks prevent repeated dispatch and double settlement.
When all calls settle, the existing wallet RPC charges actual usage and releases
the unused task reservation. The append-only ledger records wallet holds,
changes, charges, refunds and call holds/usage. No prompts, source files, tool
results or response text are written into these tables.

The proxy permits only completion/response/image routes. It verifies exact models,
prices, task state and account status, bounds token output and image options,
and blocks hosted provider tools/plugins that have no funded budget. Normal
local tools, connectors and browser operations still execute on the client.
The proxy does not retry an ambiguous paid model request.

If actual provider cost exceeds a conservative call ceiling, the full cost is
recorded, the model is blocked for investigation, and the user's final debit is
capped at the prepaid task reservation. Configure an OpenRouter service-key and
workspace budget as an independent operator safeguard against provider drift.

## Recovery and operations

Keep the existing authenticated `/api/cron/blue-runtime-reconcile` schedule active.
It reconciles per-call usage before finalizing stopped/expired tasks and also
disables/deletes legacy child credentials. Calls reserved but never dispatched
are released after a safe timeout. Dispatched calls with a server-observed
generation ID are reconciled only after the provider reports a finished or
cancelled generation.

A dispatched call with no observable generation ID is intentionally not refunded
automatically: the server cannot prove that the provider did not bill it. Query
`blue_proxy_calls` for old `dispatching`/`pending` rows without a generation ID,
match them against provider activity and resolve them through the service-role
settlement RPC only after verifying usage. This is a bounded per-task hold, not
permission to charge unverified usage or silently replay a paid request.

Check for provider overruns through `blue_runtime_model_blocks` and call usage
events. Set retention for call metadata and ledger data according to operational
and accounting requirements. Disable request-body logging in Vercel, Cloudflare
and observability tools. Cloudflare observation is disabled in the sample config.

## Local verification

`node --test lib/blueTaskProxy.test.cjs lib/blueTaskProxyLedger.test.cjs`

These tests use synthetic network dependencies and an isolated PostgreSQL runtime
(PGlite). They cover ticket expiry/tampering, scope checks, failing dependencies,
early streaming, server-only credentials, permanent-ledger settlement and real SQL
wallet/Teams transactions. A production smoke test is still required after your
manual migration, configuration and deployment.
