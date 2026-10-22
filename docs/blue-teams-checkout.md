# Blue Teams pricing and checkout

## Product rules

- Solo: ₹499 per 30 days, one project team and up to three agents.
- Pro: ₹1,499 per 30 days, three project teams and up to five agents per team.
- Business: ₹4,999 per 30 days, ten project teams and up to eight agents per team.
- These are prepaid 30-day periods. There is no automatic renewal or recurring charge.
- Teams checkout uses the same PayU, PayPal and IMR-credit flow as the normal Pricing checkout. An INR checkout can apply up to 100 IMR at ₹0.50 per IMR; USD checkout follows the existing USD equivalent. Sandbox Solo is fixed at ₹1 / $0.01 and deliberately does not consume IMR.
- The USD catalogue is fixed at $5.27 / $15.83 / $52.78. The INR list price is authoritative; review the USD equivalents before a future price update.
- PayU processes INR. PayPal processes USD for international customers; PayPal India does not support domestic payments.
- Team work runs on the user's computer. Blue and the computer must stay on while work is running; work pauses when either stops.

## Safe test mode

The Solo test price is ₹1 (or $0.01 through PayPal Sandbox). It is never accepted by the live PayU or PayPal endpoints. A successful sandbox checkout creates a `team_subscriptions` record with `is_test = true`; this is separate from, and does not replace, a live entitlement.

Set these environment variables on a private preview deployment:

```dotenv
BLUE_TEAMS_TEST_MODE=true
BLUE_TEAMS_LIVE_CHECKOUT_ENABLED=false
NEXT_PUBLIC_PAYU_URL=https://test.payu.in/_payment
PAYU_MERCHANT_KEY=<PayU test key>
PAYU_MERCHANT_SALT=<PayU test salt>
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=<PayPal sandbox client ID>
PAYPAL_CLIENT_SECRET=<PayPal sandbox secret>
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<the matching PayPal sandbox client ID>
```

The Teams page only enables sandbox checkout after both gateways have their test credentials and test endpoints configured. Test payments must be made with provider test accounts and never with production credentials. The test-mode setting must remain enabled until pending sandbox transactions settle.

## Database and launch sequence

1. Apply `supabase/migrations/031_blue_teams_checkout.sql` to the Supabase project before deploying the Teams checkout code.
2. Deploy to a private preview with the sandbox configuration above and leave `BLUE_TEAMS_LIVE_CHECKOUT_ENABLED=false`.
3. Test successful and declined PayU flows, successful/cancelled PayPal flows, refresh/retry callbacks, and verify that the Solo test record has `is_test=true` and lasts 30 days.
4. Keep live checkout disabled until the separate Blue Desktop update enforces team counts and agent limits from live entitlements. A website payment by itself does not activate Team access inside the current Desktop build.
5. After that Desktop update and acceptance test, use live PayU/PayPal credentials, set the PayU hosted-checkout URL to production and explicitly set `BLUE_TEAMS_LIVE_CHECKOUT_ENABLED=true` in the production environment only. Set `BLUE_TEAMS_TEST_MODE=false`. Live checkout is blocked outside `NODE_ENV=production` and on Vercel preview/development deployments.

## Temporary public live launch check

For a real production verification, the **Business** plan (normally ₹4,999 / $52.78) can be publicly priced at ₹1 / $0.01 for a short launch window. This is a real PayU or PayPal transaction and creates a live entitlement (`is_test=false`).

Set these in the **Vercel Production** environment only:

```dotenv
BLUE_TEAMS_TEST_MODE=false
BLUE_TEAMS_LIVE_CHECKOUT_ENABLED=true
BLUE_TEAMS_LIVE_TEST_PRICE_ENABLED=true
NEXT_PUBLIC_PAYU_URL=https://secure.payu.in/_payment
PAYPAL_ENV=live
```

Confirm the Business entitlement, then immediately set `BLUE_TEAMS_LIVE_TEST_PRICE_ENABLED=false` and redeploy. Normal customers return to the published Business price. Never put this setting in Preview or Development.

The checkout endpoints derive all prices and SKUs from the server catalogue, bind orders to the authenticated user's short-lived checkout session, verify PayU's signed response or PayPal's captured order details, rate-limit attempts, and settle payment plus entitlement atomically in `complete_blue_teams_checkout`. Duplicate verified callbacks are idempotent.
