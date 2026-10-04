# Blue subscription terms

The pricing page uses one Blue card with an accessible Monthly / Quarterly /
Yearly selector. Short benefit lists keep the cards compact; the expandable
comparison retains the complete feature list. All durations grant the existing
`blue` entitlement, including the desktop and extension, without new plan names.

| Selection | Upfront INR price | Access | Equivalent monthly | Saving vs monthly |
| --- | ---: | ---: | ---: | ---: |
| Monthly | 149 | 30 days | 149 | — |
| Quarterly | 399 | 90 days | 133 | 11% |
| Yearly | 1,299 | 365 days | 108.25 | 27% |

These are prepaid purchases, not automatically recurring subscriptions.
PayU supports all three terms in INR. The existing monthly PayPal/USD checkout
is preserved; no unapproved quarterly/yearly USD prices are offered.

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

## Deployment / verification

Apply migration 026 before deploying the website routes. It also creates the
payment-order prerequisite if migration 021 was not previously installed. It
does not rewrite existing subscriptions or unrelated schema/data.

Migration 026 was applied to the `blue-portal` Supabase project on 2026-10-04.
The website source must still be deployed to make these options public.

Run `npm run test:subscriptions` for isolated PostgreSQL settlement and route
tests. No real users or payments are used. `tsc --noEmit --incremental false`
checks the website types. Use the local `/pricing` preview to inspect the selector,
keyboard radio controls and the responsive feature comparison.
