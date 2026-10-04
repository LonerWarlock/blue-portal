# Blue subscription terms

The pricing page uses one Blue card with an accessible Monthly / Quarterly /
Yearly selector. Short benefit lists keep the cards compact; the expandable
comparison retains the complete feature list. All durations grant the existing
`blue` entitlement, including the desktop and extension, without new plan names.

| Selection | Upfront INR price | Upfront USD price | Access | Equivalent monthly INR | Saving vs monthly INR |
| --- | ---: | ---: | ---: | ---: | ---: |
| Monthly | 149 | 1.99 | 30 days | 149 | — |
| Quarterly | 399 | 5.33 | 90 days | 133 | 11% |
| Yearly | 1,299 | 17.35 | 365 days | 108.25 | 27% |

These are prepaid purchases, not automatically recurring subscriptions.
PayU supports all three terms in INR and PayPal supports all three in USD.
The USD prices were approved on 2026-10-04. The currency selector resets IMR
redemption to zero for USD; the backend preserves legacy discounted USD orders.

## Payment and access flow

1. Authenticated checkout-session creation validates the duration against
   `lib/blueSubscriptionPlans.ts`. Client-supplied price/duration values are ignored.
2. PayU signs the server price, applying at most 100 IMR (₹50) per purchase, and
   stores an owner-bound payment order for that SKU and currency.
3. The callback verifies the provider signature and stored transaction fields
   before calling `complete_blue_subscription_checkout`.
4. Migration `026_blue_subscription_billing_cycles.sql` rechecks the stored
   SKU/price/currency, atomically debits IMR and activates 30/90/365 days. Repeated
   callbacks cannot debit twice or extend twice. Active Blue access is extended
   from its existing expiry; expired access starts from completion time.
5. Existing account entitlement and expiry processing use `current_period_end`,
   so no changes to desktop, extension or expiry jobs are required.
6. PayPal uses server-created orders and server capture/verification, with the
   stored order ID, callback nonce, SKU, amount, currency and capture status checked
   before activation. Migration 027 expands trusted USD prices to all durations.
   A retry can retrieve a previously completed provider capture without charging
   again. After checkout expiry the callback only reads provider evidence; it
   cannot initiate a new charge. Completed payments may be reconciled atomically.

## Deployment / verification

Apply migration 026 before deploying the website routes. It also creates the
payment-order prerequisite if migration 021 was not previously installed. It
does not rewrite existing subscriptions or unrelated schema/data.

Migration 026 was applied to the `blue-portal` Supabase project on 2026-10-04.
Apply migration `027_blue_subscription_paypal.sql` before deploying the all-duration
PayPal routes. The website source must still be deployed to make these options public.
PayPal reuses the existing PAYG credentials: `PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, and `PAYPAL_ENV=live`
for production (`sandbox` otherwise). The public and server client IDs must
belong to the same PayPal app. No secret is passed to the browser.

Run `npm run test:subscriptions` for isolated PostgreSQL settlement and route
tests. No real users or payments are used. `tsc --noEmit --incremental false`
checks the website types. Use the local `/pricing` preview to inspect the selector,
keyboard radio controls and the responsive feature comparison.
