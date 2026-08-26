# Blue Portal Agent Guide

## Project shape

- Next.js 14 App Router application using TypeScript, React 18, Tailwind CSS, and Supabase.
- `@/*` imports resolve from the repository root; preserve this alias and existing App Router conventions.
- Product UI lives under `app/`; server routes are `app/api/**/route.ts`; shared server/domain logic belongs in `lib/`.
- Supabase schema changes are append-only migrations under `supabase/migrations/`. Do not edit an applied migration to change production behavior; add a new migration.

## Commands

- `npm run dev` starts the local app on port `3005`.
- `npm run build` validates the production Next.js build.
- `npm run lint` runs the repository's Next.js lint command.
- `npm run test:billing` runs the focused usage-accounting and Blue runtime contract tests.

Run the narrowest relevant check first, then `npm run build` for changes crossing client/server or route boundaries. Do not report tests as passing if required environment variables or Supabase access prevented them from running.

## Blue ownership boundaries

- Blue Pro marketing and checkout UI: `app/blue-pro/**`.
- Blue Pro payment and pack APIs: `app/api/blue-pro/**`; preserve authenticated request handling and provider callback flows.
- Direct runtime control plane: `app/api/runtime/**` with core logic in `lib/blueRuntime.ts`.
- PAYG wallet authentication, reservations, settlement, and credit policy: `lib/bluePayg.ts`, `lib/blueCreditPolicy.ts`, and `lib/runtimeSettlement.ts`.
- Provider/model integration: `lib/openrouter.ts` and `lib/openrouterManagement.ts`.
- Database contract: the relevant `supabase/migrations/*_blue*.sql` and runtime migrations. Keep TypeScript RPC calls aligned with the SQL function signatures and response fields.

When a route only forwards data, change the nearest shared function that makes the billing, admission, authorization, or settlement decision. Keep payment-provider code in its provider-specific route and keep shared accounting idempotent.

## Blue runtime and billing rules

- Runtime endpoints are a control plane. They must never receive or log prompts, source code, tool output, conversation history, project memory, authorization headers, or runtime credential response bodies. See [BLUE_DIRECT_RUNTIME_DEPLOYMENT.md](BLUE_DIRECT_RUNTIME_DEPLOYMENT.md).
- Treat Blue credit reservation, settlement, release, reconciliation, and payment callbacks as retryable and idempotent. Never deduct or grant credits solely because a client says a request succeeded.
- Authenticate API calls through the existing helpers and preserve the distinction between Supabase sessions, user keys, and runtime credentials. Never put service-role keys, management keys, encryption keys, or payment secrets in client code.
- Preserve access-tier and model-catalog checks. Free-model behavior, paid-model allowance ceilings, provider cost observations, and settlement grace periods are deliberate policy; update tests and migrations when changing them.
- Do not weaken the runtime kill switch, canary allowlist, credential expiry/rotation, heartbeat expiry, or cron reconciliation behavior.
- Payment success must be verified by the server/provider callback before updating wallet/profile records. Preserve the existing PayU and PayPal flows and validate pack IDs and custom-credit amounts server-side.

## UI conventions

- Reuse `PageLayout`, `Navbar`, `Footer`, `CurrencySelector`, and existing design tokens/classes before introducing new layout primitives.
- Keep the existing light-theme vocabulary (`paper`, `paper-alt`, `ink`, `ink-muted`, `line`, `brand`) and responsive Tailwind patterns. Avoid unrelated visual refactors in Blue work.
- Keep authenticated redirects consistent with `AuthContext` and the existing `redirectAfterLogin` flow.
- Preserve accessible labels, keyboard behavior, loading/error states, and stable layouts for payment and dashboard actions.

## Documentation and operational references

- [BLUE_DIRECT_RUNTIME_DEPLOYMENT.md](BLUE_DIRECT_RUNTIME_DEPLOYMENT.md) is the source of truth for runtime rollout, environment configuration, and operational checks.
- [CHECKOUT_SPEC_CORE2COVER.md](CHECKOUT_SPEC_CORE2COVER.md) documents the legacy subscription handoff to the external checkout service; do not copy its implementation assumptions into Blue Pro PAYG flows.
- [docs/tdr_and_gst_rate_breakdown.md](docs/tdr_and_gst_rate_breakdown.md) documents payment-fee calculations for course registration, not generic Blue credit pricing.

Never commit secrets, real tokens, service-role credentials, or local environment files. Before changing production-facing billing behavior, inspect the current migration and neighboring tests, then document any required deployment or SQL step.
