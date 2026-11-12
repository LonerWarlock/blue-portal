# Zero Redis on website/account flows

Prepared locally; deploy manually after migration 042.

- Website initial load/refresh and dashboard balance reads do not call Redis.
- Login/OTP guards, contact, coupon and checkout guards use one atomic Postgres
  limiter RPC instead of Redis. Existing policies and Turnstile remain enforced.
- Balances come from wallets and the Postgres blue_credit_snapshot RPC, not
  Redis or a provider balance. Existing account caches remain user-isolated.
- Desktop presence and task status remain Redis-free (migration 041).
- Redis is used only for prepaid model-call admission/hold, settlement and
  recovery of those task holds. Model streams do not access Redis per chunk.
- BYOK remains direct. No new environment variables and no new Worker change
  are needed for this website-only patch. Keep existing proxy Redis secrets.

Apply supabase/migrations/042_blue_website_postgres_limiter.sql before pushing.
It creates only operational counters and a service-role-only RPC, storing hashed
identities; it does not change account balances, subscriptions or user data.
If the migration is absent, protected actions stop safely rather than losing
abuse protection. Then push lib/trafficControl.ts and its test with the migration
and this document; wait for Vercel to deploy.

Validation: 113 tests passed (OTP route + Postgres integration, isolation,
limits, payments/subscriptions, Teams and proxy/ledger tests); production build
passed. No live user OTP/email/payment/model request was sent by those tests.
Measure live Upstash deltas after deployment; dashboard refreshes/OTP should
cause zero application Redis commands. Upstash's own console can add commands.

Windows Store package was prepared first: 0.1.44.0, x64, verified actual APPX.
The website limiter change is server-only and does not change the APPX bytes.
