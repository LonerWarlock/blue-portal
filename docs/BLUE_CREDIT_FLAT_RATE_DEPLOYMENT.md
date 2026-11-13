# Blue Credits: flat INR pricing

## Deploy

1. Apply `supabase/migrations/043_blue_credit_fractional_purchase_precision.sql` in the Supabase SQL editor.
2. Push the Portal changes and allow Vercel to deploy them.
3. Confirm `/pricing` shows ₹115 / Credit. A 5-credit PayU quote is ₹575. A custom ₹500 purchase adds 4.347826087 credits.

The migration increases purchase-quantity precision to match the wallet. Existing balances, payment quotes, pending purchases and subscription plans are preserved. No environment-variable change or Cloudflare Worker deployment is needed.

## Rules

- INR credit purchase: credits × ₹115, with no additional checkout fee.
- Custom INR purchase: amount paid ÷ 115, stored at Postgres numeric(18,10) precision. INR amounts support two decimal places.
- Whole credit quantities: 1–100; custom INR payments: ₹1–₹11,500.
- International checkout is $1.30 per credit as one flat total. Custom USD payments from $1–$130 receive amount paid ÷ 1.30 credits at numeric(18,10) precision.
- Custom inputs allow clearing and retyping. Empty or zero values reset to the minimum on blur; invalid amounts cannot initiate payment.
- 1 Blue Credit still covers $1.00 of actual OpenRouter model usage in Postgres and the proxy holds. No purchase markup is added during usage.
- Team activation still requires at least 25 credits in one verified purchase (₹2,875). A payment below ₹2,875 does not round up into eligibility.
- The ₹149 app-access subscription includes 0 Blue Credits and is unchanged.
- Payment callbacks settle immutable saved quotes, including purchases created before the pricing change.

## Checks

Pricing, signed payment quotes, custom rupee amounts, tampered inputs, old payment callbacks, fractional settlement, duplicate settlement, Teams eligibility and the existing subscription suite are covered by isolated tests. No real payment is submitted by these checks.

Run `npm run test:credit-checkout` for the full credit checkout regression suite. The React DOM test mounts the real checkout with synthetic auth and PayPal controls; it checks SDK loading, input edits, repeated currency changes, delayed SDK cleanup, blocked stale callbacks and retry after render failure. No live payment is made.
