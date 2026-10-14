# Payment confirmation reliability

Hackathon solo registration previously passed the public form but failed the
database's legacy two-person minimum after payment. Migration 029 allows solo
teams and preserves historical five-person teams. It does not delete records.

Production hackathon, subscription and PAYG checkout routes now use the verified
`https://blue.imergene.in` payment origin, independently of a retired
`NEXT_PUBLIC_SITE_URL`. Arbitrary request hosts and external return URLs are not
trusted. Loopback development remains local.

Shared PayU reverse hashing preserves the original signed fields, supports the
five UDF fields and both additional-charge spellings, and rejects tampering.
Provider success followed by a registration/activation failure is confirmation
pending, not proof that money was never deducted. Pending orders are retained
for reconciliation; successful settlement remains idempotent.

PAYG PayPal capture verifies the stored order token before contacting PayPal and
the captured amount, currency, transaction binding and single capture before
credit activation. Already-captured retries read provider evidence and retry
atomic settlement, without adding credits twice.

Migration 030 permits service-role settlement of verified, already-paid PayU
callbacks after checkout expiry, as PayPal reconciliation already allowed.
Creation and initiation still enforce expiry in their routes. Provider evidence,
prices, owned order matching, atomic IMR spending and replay protection remain
mandatory. Apply migration 030 to production only with explicit approval.

Focused checks (no real charges):

```
node --experimental-strip-types --test tests/payment-reliability.test.cjs tests/hackathon-payments.test.cjs tests/hackathon-schema.test.cjs lib/blueSubscriptionRoutes.test.mjs lib/blueSubscriptionPaypalRoutes.test.mjs lib/blueSubscriptionPlans.test.mjs
```

These checks cover real SQL solo constraints and subscription settlement, mocked
provider callbacks, failure/retry behavior, tampering and duplicate settlement.
They are not a guarantee against bank/provider outages or a claim that every
production gateway flow has been paid end-to-end.
