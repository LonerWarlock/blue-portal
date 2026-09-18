# Account cache and coupon release

- Profile/subscription cache: five minutes, shared across client-side navigation.
- Wallet cache: 45 seconds, stale-while-revalidate without replacing cached UI with a spinner.
- Coupon claims, IMR redemption and payment returns invalidate the cache, including other open tabs.
- Empty Blue Pro wallets have Lite access. An independently active monthly Blue subscription remains active.
- Tokens and API keys are never persisted to browser storage by the account cache.

## Required database rollout

Apply `supabase/migrations/023_atomic_imr_coupons.sql` in the **portal's Supabase SQL Editor** before releasing coupon changes.
It creates the shared coupon store and server-only transactional claim/import functions; pushing code does not run it.
Deploy blue-portal and blue-admin configured with the same Supabase URL and server-only service role key.
In admin's Coupons page, click **Import legacy coupons** once to import existing Neon/SQLite codes and claim history.
Imports never award IMR again or overwrite existing shared codes. Missing claim history disables the affected code for review.
There is intentionally no hardcoded campaign or alternative database fallback.

The prior uncommitted portal campaign `GANESHCHATURTI` (100 IMR, expires 23 September 2026) should be
created in the shared store if it is still intended to be offered; reconcile any former claims before enabling it.

## Verification

`npm run test:account` executes cache, plan and real embedded-PostgreSQL transaction tests.
`npm run build` validates the production build.
Live acceptance still requires a signed-in user: claim a configured coupon once, verify the IMR increase,
confirm a repeated claim is rejected, and navigate between Console/Pricing/Subscribe without an account reload.
