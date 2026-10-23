# Teams plan management and prepaid billing

## Policy

The nearest OpenAI comparison is ChatGPT Business's remaining-period upgrade and
next-period downgrade policy:
https://help.openai.com/en/articles/8792536-managing-billing-and-seats-in-chatgpt-business

This is not a claim that all OpenAI products have identical billing. Blue remains
prepaid: there is no payment mandate, automatic debit or recurring renewal.

- A new Teams purchase grants 30 days after verified payment.
- A same-tier renewal adds 30 days after existing access, preserving unused time.
- An upgrade changes tier only after verified payment, keeps the existing expiry
  and charges a server-quoted remaining-period adjustment. Credit is based on the
  actual amount paid, not the nominal catalogue price. The original paid currency
  is retained; complimentary grants have zero cash credit. Upgrade adjustments
  cannot also redeem IMR.
- A downgrade saves a cancellable next-plan preference. Current higher-tier access
  remains until expiry. At expiry, payment is required to start the chosen lower
  plan: saving a preference does not automatically charge or grant access.
- The existing temporary public Business launch price remains governed by its
  server configuration; it is not silently reset to the catalogue price.
- Regular Blue monthly/quarterly/yearly access has the same feature tier. Further
  purchases extend time; separate non-expiring Blue Pro model credits are not
  replaced or converted. Active app access stays visible alongside Pro credits.

Quotes are immutable server-owned checkout metadata. The UI cannot choose the
amount, account, granted tier, limits or period. Only service-role payment routes
can call the database settlement/management functions after authentication and
provider receipt verification.

## Collision and recovery rules

Identical viable Teams checkout attempts reuse the existing quote. A different
unresolved payable attempt blocks another plan purchase. Gateway payment rows
are not overwritten to turn an old receipt into a new order. Regular Blue retries
likewise reuse a bound pending payment attempt.

An older verified payment that conflicts with changed access is recorded once
in `blue_teams_payment_reviews`; it does not overwrite the newer plan and is not
reported as activation success. Callback replay returns the same outcome. An
unresolved collected-payment review blocks new and already-open quotes from
inviting another charge.

More than 30 prepaid days remaining, unverifiable legacy paid value and another
prorated upgrade within an already-upgraded period require support review before
another payment. These cases deliberately do not guess credit values or charge
the customer first.

Review reconciliation is an explicit administrative operation after checking the
provider receipt and deciding fulfilment/refund. Do not mark `resolved_at` and
`resolution` merely to unlock another checkout without reconciling the payment.

All Teams mutations acquire the same account/environment advisory lock before
row locks. The single-backend PGlite tests execute the SQL and guard lock ordering;
they are not a claim of multi-connection PostgreSQL stress testing.

## Manual rollout order

No commit, push, deployment or migration 034 application was performed for this
change. Pushing the website alone does **not** apply Supabase migrations.

1. Keep Teams checkout paused during the cutover (temporarily disable
   `BLUE_TEAMS_LIVE_CHECKOUT_ENABLED` in the production deployment, preserving its
   previous value for restoration). Existing payment confirmation routes remain
   available. Do not cancel or discard already-collected receipts.
2. Apply migration `033_blue_teams_admin_grants.sql` if it is not already applied.
   It was previously applied to the current production project for the authorized
   complimentary Teams grant; do not create another grant during this rollout.
3. Apply `034_blue_teams_plan_transitions.sql` to the same Supabase project. It is
   transactional and reapply-tested. Retain payment review/audit records.
4. Manually push and deploy the website changes, including both new migrations,
   API routes, account summaries, checkout form and tests. Do not commit local
   credentials or `.env` files. Restore the intended checkout configuration only
   after the matching application and SQL are ready.
5. Sign in and check the active Teams badge, expiry and capacities. Check the
   upgrade checkout's quoted amount and unchanged expiry without approving a real
   charge unless explicitly intended. A downgrade should state payment-required
   at expiry and should be cancellable without opening a gateway.

The new payment-initiation routes fail closed if their validating SQL functions
are unavailable. That protects against charging against an unverified quote, but
does not replace the coordinated rollout above.

## Local verification

- 162 focused website tests passed: Teams migration/quotes/routes, account and
  auth boundaries, regular subscription idempotency, active-plan components and
  both checkout lifecycles. No real gateways, charges or user records were used.
- Production Next.js build passed, including type checking and 67 generated pages.
- SQL migration 034 is reapply-tested and has 21 executable transition tests.
- Separate Desktop main-response fix: 142 focused tests and TypeScript/Vite build
  passed; no Blue launch, installation or Store submission is asserted here.

Optional visual QA fixture output, if generated, is local test material and is
not a screenshot of a real customer's account or production entitlement.
