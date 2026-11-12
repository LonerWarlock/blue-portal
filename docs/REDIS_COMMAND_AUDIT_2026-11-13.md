# Redis command audit and optimized deployment

## Recorded usage: exact reconstruction

The signed-in Upstash Usage tab showed 966 commands: 724 writes and 242 reads.
Its Top Commands Usage table showed these cumulative counts:

| Command | Count | Category |
| --- | ---: | --- |
| EVAL | 239 | write |
| EXPIRE | 234 | write |
| INCR | 233 | write |
| HINCRBY | 6 | write |
| HDEL | 3 | write |
| HSET | 3 | write |
| ZADD | 3 | write |
| ZREM | 3 | write (reconstructed from three completed holds; below top ten) |
| TTL | 230 | read |
| HGET | 9 | read |
| ZCARD | 3 | read |

The old proxy executed three Lua scripts per model call: rate, hold, release.
Each successful call caused 13 writes and 4 reads, counting the outer EVALs.
Three completed proxy calls account for 39 writes + 12 reads = 51 commands.

The remaining 915 commands came from 230 invocations of trafficControl.ts's
general limiter: 230 EVAL + 230 INCR + 225 EXPIRE + 230 TTL. This accounts for
685 writes and 230 reads. Together the two paths reproduce 724/242 exactly.

The general limiter was used on Desktop activity uploads, runtime status GETs,
admission, and auth/payment/contact actions. Desktop presence uploads happen
every 60 seconds even without a new prompt. The history is spread across hours,
not two isolated model requests. Aggregate command metrics do not retain which
HTTP route invoked each generic EVAL; attributing all 230 to a particular route
would require historical Vercel request logs. Activity/status are the recurring
sources in the code and have both been moved off Redis.

There were no Redis calls on every SSE chunk. Stream keepalives only enqueue
comments; runtime heartbeats update Postgres, not Redis. Two user prompts are
not necessarily two provider calls (tools/reviewer/agent turns are separate).
Upstash Console activity can also count, but is not needed to explain these totals.

## New shared Worker / Vercel implementation

1. Validate ticket signature, expiry, audience, user/task/device/model locally.
   Keep durable Postgres authorization/reservation/settlement authoritative.
2. One atomic admission EVAL reads one account sorted set and checks duplicate
   call, 120 accepted requests/minute/account, 8 active calls/task, and task held
   spend. A single ZADD stores the rate marker and the individual call hold.
3. Stream entirely without Redis I/O. First observed generation ID is recorded
   once in Postgres for recovery, never once per chunk.
4. Settle actual provider cost in Postgres, then one idempotent ZREM releases
   only that call. Concurrent cancel/completion share one finalizer.

| Stage | HTTP calls to Redis | Upstash counted commands |
| --- | ---: | ---: |
| Admission | 1 | EVAL + ZRANGE + ZADD = 3 |
| SSE/events/keepalives | 0 | 0 |
| Successful settlement | 1 | ZREM = 1 |
| Complete normal provider request | 2 | **4** |
| Desktop presence/status/task admission | 0 | **0** |

Rate-limited/rejected admission uses fewer commands. Recovery after a crash or
Redis outage may require an extra idempotent cleanup attempt. A durable cleanup
acknowledgement prevents rescanning/releasing every historical settled call on
each cron invocation. Unknown provider spend stays reserved, never auto-refunded.

The account sorted set retains one small fixed rate marker while idle. It does
not create a key per poll/minute, and active holds are removed only after durable
settlement. Postgres migration 041 provides shared control-plane limiting and
cleanup acknowledgements. Payment, OTP, coupon and contact rate limits remain
unchanged. BYOK remains direct and does not use this prepaid gate.

## Validation

- Production Lua executed in a Lua runtime with Redis-command instrumentation:
  exactly four counted commands, budget/duplicate/concurrency/rate/isolation tests.
- 53 Portal tests: ledger, refunds, cleanup retries, status limits, telemetry,
  1,500 SSE events, cancellation race, ticket isolation and fallback.
- Compiled Worker streamed and settled in real local Cloudflare workerd runtime.
- Portal production build passed. No paid model requests used for these checks.
- Live Upstash command delta still needs verification after both deployments;
  the previous 966-command total is historical and will not disappear.

## Deploy in this order

1. In Supabase SQL Editor apply **041_blue_runtime_control_limiter.sql**.
   Migration 038 (activity limiter) and 039 (proxy ledger) must already exist.
   This does not alter balances, prompts, models or existing credit ledger events.
2. From PowerShell deploy the updated Worker:

```powershell
Set-Location 'C:\Users\ASUS\Desktop\blue-portal\edge'
npm ci
npm run check
npm run deploy
npm run verify -- https://blue-inference-proxy.blue-inference-worker.workers.dev/v1
```

Existing six Cloudflare secrets stay saved; do not upload them again. If login
expired, run `npx wrangler login` before deploy. Do not change the Worker name.
3. Push prepared Portal sources manually and wait for Vercel. Retain the same
   Worker URL and BLUE_RUNTIME_PROXY_FALLBACK_ENABLED=true. No new env vars.
4. Test a new Blue Credits chat and Teams task. Confirm final credit settlement
   and compare Upstash command deltas with provider-call count, not prompt count.
   Idle presence/status polling should cause zero Redis commands after Vercel deploy.
   Avoid Data Browser/CLI activity while measuring; Console tools can add commands.

Updating only the Worker removes proxy overhead but cannot stop the old Vercel
activity/status limiter. Both deployments are required. Do not delete Redis keys
or flush the database: old possibly-spent holds must remain protected.
