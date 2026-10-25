# Blue Teams: 25-credit PAYG activation and checkout platform fee

Prepared locally on 2026-10-25. Nothing has been pushed or applied to the production database.

## Deployment order

1. Apply `supabase/migrations/036_blue_teams_credits_and_platform_fee.sql` manually in Supabase, after prior migrations through035.
2. Deploy the matching website/backend and then distribute the matching Desktop build. The new runtime depends on the v4 admission/v2 extension RPCs; do not deploy it before036.
3. Test one authenticated custom25credit checkout using the intended payment provider. The UI and backend should show25 credits, base$25 + platform fee$7.50 = $32.50, or baseINR2500 + platform feeINR750 = INR3250 using the existing fixed INR conversion.

## Product rules

- New Solo/Pro/Business Teams subscriptions and scheduled renewals are retired (HTTP410 and database quote refusal). Existing already-collected provider orders can still be reconciled using their immutable saved amount.
- Existing paid Teams access is honoured until its original expiry with its original capacity. All Teams inference uses Blue Models.
- A single verified completed PAYG purchase of at least25 Blue Credits activates Teams (10 projectteams,8 agents/team). Several smaller purchases do not qualify cumulatively.
- While active, any supported top-up adds to the same wallet without resetting it. The platform fee never becomes additional credits.
- At settled wallet exhaustion, credit-based Teams access is revoked. A new qualifying purchase is required. Replaying an earlier completed payment or adding administrative credits cannot reactivate it.
- Available funds plus still-pending holds determine whether the wallet has actually been exhausted. Merely reserving the last available credit does not revoke access.
- Qualifying-payment reversals revoke their activation. Existing wallet funds and task/conversation history are not deleted.

## Rates and pending tasks

New usage is exactly one Blue Credit per USD1 of authoritative OpenRouter usage. The30% platform fee is charged once at checkout. Old `BLUE_CREDIT_MULTIPLIER` environment values no longer change new usage rates or purchase prices.

Migration036 snapshots previously pending reservations/tasks at the former default1.5 rate so an admitted task does not change contract midway. If this deployment used a customized old rate, set `blue.legacy_credit_multiplier` in the same SQL session before executing036. New reservations default1. Previously queued tasks inherit their original binding when first reserved. Reapplying036 does not overwrite existing bindings.

The migration deliberately does not infer access from lifetime purchased credits: that history cannot establish whether a wallet previously reachedzero. Old positive PAYG balances remain intact; a new qualifying purchase is needed unless a still-valid paid Teams subscription already grants access.

## Authority and verification

Server-side v4 admission persists the requested feature and checks Teams authorization within the database transaction. Extensions check the bound feature; retries of an already-applied extension cannot charge twice. Wallet identity, feature and hold billing rates are server-owned. Supabase RPCs and the activation ledger are not directly executable/readable by anonymous or authenticated browser roles.

Focused regressions cover both payment providers' gross fees, immutable legacy orders, account identity, single-purchase activation, top-ups, exhaustion/reactivation, holds/refunds/replays, legacy expiry, old/new rates, queued tasks, runtime feature binding and idempotent extension retries. These are local isolated tests; they do not certify a live deployment or execute a real payment.
