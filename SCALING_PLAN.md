# Blue Portal Scaling Implementation Plan

## Implementation status

This repository now contains the launch-critical application changes: CDN-friendly marketing rendering, lazy media, cached model discovery, distributed rate limits, Supabase Auth OTP, browser Turnstile validation, a separately throttled VS Code OTP lane, payment verification and transactional settlement, hashed Blue keys, a single-request console bootstrap, SQL usage aggregation, a durable AI admission queue, task-scoped OpenRouter credentials, direct extension-to-OpenRouter streaming, cron protection, a transactional email outbox, health/readiness checks, error boundaries and emergency kill switches.

The companion BlueV2 extension protocol is version 1 and the corresponding extension release is 0.6.41. Production activation still requires applying migrations 020-022, configuring the variables in `.env.example`, configuring managed-service quotas/WAF/alerts, publishing extension 0.6.41 before enabling the protocol, and passing the staged load tests in section 11. Infrastructure configuration and measured 1,000/5,000/7,500-user capacity cannot be truthfully completed by a source-code commit alone.

## 1. Goal and Capacity Model

Prepare Blue Portal for:

- 1,000 simultaneous visitors during normal campaign traffic.
- 5,000 simultaneous visitors during an unexpectedly successful traffic surge.
- A temporary spike of 7,500 simultaneous visitors without a site-wide failure.
- Initially 100 simultaneous AI tasks, protected by a global admission limit and queue.

The 5,000-user target refers to concurrent website sessions, not 5,000 simultaneous AI generations. Marketing traffic must remain available through the CDN even when authentication, payments, email, or AI providers are throttled.

Use the following managed production services:

- Vercel Pro with Fluid Compute for Next.js hosting and functions.
- Supabase Pro for Auth, Postgres and the Data API.
- Upstash Redis for distributed rate limits and abuse counters.
- Resend for authentication and transactional email.
- Cloudflare Turnstile for CAPTCHA.
- Sentry for application errors and performance monitoring.
- PostHog for product and conversion analytics.

Configure Vercel functions in the region closest to the existing Supabase project. Vercel supports significantly more than 5,000 concurrent function invocations, but the application must still protect Supabase, SMTP, payment gateways and OpenRouter from uncontrolled bursts.

References:

- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [OpenRouter limits](https://openrouter.ai/docs/api_reference/limits)

## 2. Final AI Architecture

Blue will operate as a control plane only. Model prompts and streamed responses will travel directly between the extension and OpenRouter.

    Extension -- Blue API key --> Blue control plane
                                  |
                                  | authentication, balance,
                                  | queue, reservation and limits
                                  |
                                  +-- temporary OpenRouter child key --> Extension

    Extension ===== direct model request and stream =====> OpenRouter

    Extension -- heartbeat, completion or cancellation --> Blue control plane

The Blue API key must never be sent to OpenRouter. The OpenRouter management key must never be returned to the extension.

### Direct-runtime workflow

1. The extension sends its Blue API key, requested model and maximum-token settings to POST /api/runtime/v1/tasks.
2. Blue validates the key, account state, model access, available balance, per-user concurrency and global capacity.
3. If admitted, Blue reserves the maximum expected charge and creates a restricted OpenRouter child key.
4. Blue returns the OpenRouter base URL, temporary child key, task ID, allowed model and lease expiry.
5. The extension calls OpenRouter directly and receives the SSE stream directly from OpenRouter.
6. The extension sends a heartbeat to Blue every 30 seconds while the task is active.
7. On completion, the extension sends the OpenRouter generation ID and completion state to Blue.
8. Blue verifies usage against OpenRouter, settles the actual charge and revokes the child key.
9. On cancellation, the extension aborts its OpenRouter request locally and calls the Blue cancellation endpoint.
10. If the extension disappears, a background reconciler verifies usage, settles or releases the reservation, and revokes the child key after the lease expires.

For every direct Blue request, the extension keeps the user-selected model fixed and asks OpenRouter to choose the healthiest compatible provider connection. It enables provider fallbacks, requires support for the request parameters, and supplies soft latency/throughput preferences. It deliberately does not force a provider or `sort` mode, preserving OpenRouter's default uptime-aware load balancing and fallback behavior.

Temporary OpenRouter credentials must:

- Allow only the requested model or an explicitly approved fallback group.
- Have a spending cap no greater than the task reservation.
- Be kept only in extension memory.
- Be excluded from logs, analytics and error reports.
- Be revoked on completion, cancellation, queue expiry or missed heartbeats.
- Be reconciled server-side instead of trusting client-reported token counts.

### Disable Blue streaming

- Set ENABLE_LEGACY_AI_PROXY=false in production.
- The extension must not call /api/chat/completions.
- When the proxy is disabled, /api/chat/completions returns 410 Gone with migration guidance.
- No prompt, model output or OpenRouter SSE stream should pass through a Blue Vercel Function.

## 3. Launch-Critical Security

Complete these changes before increasing advertising traffic:

- Reject PayU callbacks immediately when signature verification fails.
- Replace client-provided amount, currency, product name, discount and redirect information with a server-owned product SKU.
- Add a typed payment_orders table containing the expected account, product, amount, currency, gateway identifiers, status and expiry.
- Verify PayPal order ID, invoice/custom ID, amount, currency and account ownership against payment_orders.
- Settle payment, wallet deduction, discount consumption and subscription activation in one locked, idempotent database RPC.
- Calculate IMR redemption on the server while the wallet row is locked.
- Revoke anonymous access to registrations, subscriptions, checkout sessions and other personal data.
- Restrict privileged RLS policies explicitly to the service role.
- Store Blue API keys as hashes and support safe rotation.
- Validate required environment variables during application startup.
- Make cron endpoints fail closed when CRON_SECRET is absent and accept the secret only through the Authorization header.

## 4. Public Website and CDN

- Split marketing and authenticated application layouts without changing public URLs.
- Remove the global Supabase session check from anonymous marketing pages.
- Render the homepage immediately instead of showing a spinner while getSession runs.
- Keep marketing pages statically generated and served through the Vercel CDN.
- Cache the public model catalogue for five minutes with a one-hour stale fallback:

      Cache-Control: public, s-maxage=300, stale-while-revalidate=3600

- Store the last successful OpenRouter catalogue snapshot so an upstream failure does not break the website.
- Replace the render-blocking Font Awesome CDN stylesheet with local Lucide icons.
- Transcode the current approximately 36 MB of public videos into responsive WebM and MP4 variants under 4 MB each.
- Add video posters, preload="none" and viewport-based playback.
- Keep PostHog pageview, CTA, signup, checkout and conversion events.
- Disable broad PostHog autocapture for campaign visitors and use identified-only person profiles.

## 5. Authentication, Abuse Protection and Rate Limits

Replace the custom OTP storage and deterministic-password implementation with Supabase Auth OTP while preserving the existing website response envelope.

Authentication changes:

- POST /api/auth/send-otp calls Supabase Auth OTP. Browser callers submit a Turnstile token; the VS Code extension uses an explicitly identified, fail-closed Redis-limited lane because a native extension cannot safely host the browser challenge.
- POST /api/auth/verify-otp calls Supabase verifyOtp and returns the existing session envelope.
- Remove plaintext OTP storage, Math.random OTP generation, deterministic passwords and admin.listUsers fallback.
- Configure Resend as custom Supabase SMTP.
- Configure enough project-level OTP capacity for at least 2,000 sends per hour before the campaign.

Add Vercel WAF bot protection and Redis-backed application limits:

- OTP send: 3 per email per hour, 20 per IP per 10 minutes and 200 globally per minute.
- OTP verification: 5 attempts per OTP before invalidation.
- Contact form: 5 submissions per IP per hour.
- Checkout creation: 10 per user and 20 per IP per 10 minutes.
- Trial AI task creation: 20 requests per user per minute and 1 active task.
- Paid AI task creation: 60 requests per user per minute and 3 active tasks.
- Task-status polling: 30 requests per task per minute.

All throttled endpoints return a consistent 429 response and a Retry-After header. Provider or dependency outages return a bounded 503 response rather than allowing requests to accumulate.

## 6. AI Admission Queue

Initial production limits:

- GLOBAL_AI_CONCURRENCY_LIMIT=100
- Maximum queued tasks: 500
- Queue timeout: 2 minutes
- Heartbeat interval: 30 seconds
- Lease expiry after missed heartbeats: 2 minutes

Use a transactionally locked Supabase/Postgres queue for admission metadata and global capacity slots, and Upstash Redis for token buckets. The Postgres advisory lock, row locks and `SKIP LOCKED` promotion make reservation, queue fairness and slot assignment atomic across serverless instances. Store only task ID, user ID, access tier, requested model and timestamps; never store prompts or generated output.

Use separate paid and trial FIFO queues with weighted scheduling so paid traffic receives priority without permanently starving trial users. Billing reservation and OpenRouter credential creation happen only after a task receives a global slot.

API behaviour:

- POST /api/runtime/v1/tasks returns 200 when immediately active.
- POST /api/runtime/v1/tasks returns 202 when queued.
- POST /api/runtime/v1/tasks returns 429 capacity_reached when the queue is full.
- GET /api/runtime/v1/tasks/:requestId returns queued, provisioning, active, completed, cancelled, failed or expired.
- POST /api/runtime/v1/tasks/:requestId/heartbeat renews the active lease.
- POST /api/runtime/v1/tasks/:requestId/complete verifies provider usage and settles billing.
- POST /api/runtime/v1/tasks/:requestId/cancel cancels queued work or revokes an active child key.

Queued response:

    {
      "request_id": "task-id",
      "state": "queued",
      "position": 12,
      "retry_after_ms": 2500
    }

The queue protects Blue billing and provider spending. It is not used to proxy or buffer OpenRouter model streams.

## 7. Database and API Efficiency

- Add GET /api/me/bootstrap for account, wallet, subscription, Blue-key status, model access and runtime summary.
- Authenticate once for the bootstrap request instead of repeating Supabase Auth calls across parallel console APIs.
- Replace repeated wallet/profile/reservation lookups with one indexed database RPC.
- Remove reconciliation and expired-reservation cleanup from wallet and model reads.
- Run runtime and billing reconciliation once per minute with a distributed lease.
- Move usage aggregation into SQL instead of fetching every billing transaction into application memory.
- Add composite indexes for:

  - credit_payments(user_id, created_at DESC)
  - billing_transactions(user_id, account_type, created_at DESC)
  - subscriptions(status, current_period_end)
  - Payment provider transaction IDs
  - OTP and payment-order expiry
  - Active runtime tasks and reconciliation state

- Establish a complete reproducible migration baseline for every table referenced by the application.
- Cache model and blocked-model configuration in Redis with a last-known-good fallback.
- Add explicit connect, idle and total timeouts to OpenRouter management, PayPal, PayU and SMTP calls.
- Cache PayPal OAuth tokens until shortly before expiry.

## 8. Background Jobs and Email

- Add a transactional job_outbox table with idempotency key, job type, payload, status, attempts, next-attempt time and last error.
- Insert confirmation jobs in the same transaction as the corresponding payment or registration change.
- Process jobs in bounded batches with retry backoff, dead-letter status and overlap locks.
- Move payment confirmations, marketing campaigns and subscription reminders out of request and callback handlers.
- Rewrite campaign jobs to use cursor pagination instead of loading all Auth users and related tables into memory.
- Do not expose recipient email lists in cron responses or logs.

### Scheduler deployment

The checked-in `vercel.json` uses one daily invocation per endpoint so deployments remain valid on Vercel Hobby. This is a deployment-safe fallback, not the production cadence for an advertising launch.

For production, use Vercel Pro or an external scheduler and invoke the protected endpoints with `Authorization: Bearer $CRON_SECRET` at these intervals:

- `/api/cron/blue-runtime-reconcile`: every minute.
- `/api/cron/jobs`: every minute.
- `/api/cron/subscription-check`: hourly.
- `/api/cron/marketing-campaign`: daily.

Do not launch paid traffic with only the Hobby daily cadence: stale runtime leases and transactional email jobs could remain pending for up to 24 hours.

## 9. Observability and Safety Controls

Add Sentry and structured server logs with request IDs. Never log emails, OTPs, bearer tokens, Blue keys, OpenRouter credentials or complete request payloads.

Monitor:

- Concurrent visitors, function invocations and function errors.
- CDN hit ratio and marketing-page performance.
- Supabase CPU, database latency, Auth errors and failed queries.
- AI queue depth, queue age, active leases and provisioning latency.
- OpenRouter management failures, provider 429/5xx responses and spending.
- Payment settlement failures and duplicate attempts.
- OTP and transactional-email delivery failures.
- Reconciliation and outbox backlog.

Create alerts for:

- Unexpected 5xx rate above 1% for 5 minutes.
- Read API p95 above 750 ms.
- Mutation API p95 above 1.5 seconds, excluding payment-provider processing.
- Supabase CPU above 70%.
- OpenRouter error rate above 2%.
- AI queue depth above 200 for 5 minutes.
- Reconciliation or outbox jobs older than 5 minutes.

Add kill switches for new OTP sends, checkout creation and new AI admission. The static marketing site must remain available when a kill switch is active.

## 10. Extension Changes

The extension must:

- Continue storing and sending the Blue API key only to Blue endpoints.
- Stop sending model requests to /api/chat/completions.
- Call POST /api/runtime/v1/tasks before every model task.
- Handle 200 active, 202 queued, 429 capacity_reached and bounded 503 responses.
- Poll queued tasks using retry_after_ms plus random jitter.
- Open the model request directly against the returned OpenRouter base URL.
- Use the temporary OpenRouter child key only for that admitted task.
- Never persist or log the temporary credential.
- Send heartbeats every 30 seconds.
- Send the OpenRouter generation ID when completing the task.
- Abort OpenRouter locally and call the Blue cancellation endpoint when the user cancels.
- Clear the credential from memory after completion, cancellation or failure.
- Prompt the user to upgrade the extension if the server reports an unsupported runtime protocol version.

Add runtime_protocol_version to task responses so incompatible extension versions fail clearly instead of silently falling back to the streaming proxy.

## 11. Testing and Acceptance Gates

Automated correctness tests:

- PayU signature rejection.
- PayPal order, amount, currency and ownership validation.
- Concurrent and repeated payment callbacks.
- Transactional wallet and subscription settlement.
- RLS checks using anonymous, authenticated and service-role clients.
- OTP cooldown, attempt exhaustion, CAPTCHA and distributed limits.
- Queue admission, fairness, lease expiry and slot recovery.
- Child-key restriction, spending cap and revocation.
- Completion reconciliation using verified OpenRouter usage.
- Extension behaviour for queued, throttled, cancelled and expired tasks.

Load-test scenarios:

1. Ramp from 0 to 1,000 virtual users, sustain for 15 minutes and cool down.
2. Ramp to 5,000 concurrent website sessions and sustain for 10 minutes.
3. Spike to 7,500 website sessions for 2 minutes.
4. Run 100 simultaneous direct OpenRouter streams using a provider mock or controlled test budget.
5. Inject Supabase latency, OpenRouter 429/500 responses, email failures and payment-provider timeouts.

Website traffic mix:

- 85% cached marketing navigation.
- 10% authentication and console reads.
- 5% contact, registration and checkout initiation.

Do not send real payment captures or bulk production emails during load tests.

Launch gates:

- Cached TTFB p95 below 300 ms.
- Marketing page-load p95 below 2 seconds.
- Read API p95 below 750 ms.
- Mutation API p95 below 1.5 seconds, excluding provider processing.
- Fewer than 1% unexpected errors.
- Zero duplicate payments or billing settlements.
- No leaked OpenRouter child keys.
- No database or provider quota exhaustion.
- Excess traffic receives controlled 202, 429 or 503 responses instead of widespread 500 errors.
- The static marketing site remains available during dependency failure tests.

## 12. Rollout Order

1. Create a staging Supabase project and preview deployment with production-equivalent configuration.
2. Apply payment, RLS, API-key and environment-security fixes.
3. Deploy static marketing, video and public-cache improvements.
4. Deploy Supabase Auth OTP, Turnstile and Redis rate limits.
5. Deploy the direct OpenRouter runtime protocol and updated extension behind a feature flag.
6. Verify direct streaming and disable the legacy Blue proxy in staging.
7. Deploy database consolidation, reconciliation and outbox processing.
8. Enable Sentry dashboards, alerts, cost alerts and kill switches.
9. Pass the 1,000-user test, then the 5,000-user test and 7,500-user spike.
10. Release the extension update before enabling the new runtime protocol in production.
11. Roll out Meta ads at 10%, 25%, 50% and 100%, reviewing the dashboards between stages.

## 13. Final Success Criteria

The implementation is complete when:

- Website traffic is served primarily from the CDN.
- Blue never proxies normal OpenRouter model streams.
- A Blue key can only authenticate with Blue and cannot be used directly with OpenRouter.
- Every OpenRouter child key is restricted, spending-capped, tracked and revoked.
- AI overload is contained by admission limits and a visible queue.
- Authentication and payments remain correct under retries and concurrency.
- The site passes the 1,000-user baseline, 5,000-user surge and 7,500-user spike tests.
- Operators can identify overload, stop costly admissions and preserve the public website without redeploying.
