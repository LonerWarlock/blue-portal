# Organization Plan rollout — 15 November 2026

## Status
- Organization schema, billing, checkout, admin console and invitation revocation are implemented locally.
- Main pricing separates Individual and Organizations, with Organization/Custom cards and INR/USD selection.
- Personal prices remain INR 115 / USD 1.30; the INR 149 subscription is unchanged.
- Organization prices are INR 115 / USD 1.15 per credit; online purchases accept 50–1,000 whole credits.
- Worker deployed in required atomic mode: version `97c2a167-23c5-4e6b-b72c-f9300e739d02`.
- Portal has NOT been pushed or deployed by Codex. SQL has NOT been applied by Codex.

## Apply in this order
1. Open Supabase SQL Editor for Blue. Run the complete `supabase/migrations/045_blue_organizations.sql` file. This is additive and preserves personal balances and existing task bindings. Reapplying it does not reset Organization balances or ledger history.
2. For local testing, add `BLUE_ORGANIZATIONS_ENABLED=true` to your local Portal `.env.local`, then restart the local server. Keep the production flag false until the new clients are ready.
3. Run `npm run build` in `C:\Users\ASUS\Desktop\blue-portal`. Preview with `npm run dev` at `http://localhost:3005`.
4. Test `/pricing?audience=organizations`, `/organizations`, and the generated `/organizations/<id>/admin` URL. A signed-in owner creates an Organization, purchases credits, invites another account, and revokes a pending invite to recover its seat.
5. Test on two accounts: accept the invitation using its exact verified email; select Organization billing in Blue; run a small task; confirm the shared balance, held credits and member spending. No personal purchase is required for a funded member.
6. Push Portal manually after local testing. Add Vercel Production `BLUE_ORGANIZATIONS_ENABLED=true` only when Organization-enabled clients have been tested and released. The Worker and Portal source force required atomic admission even if an old environment variable says auto/legacy.
7. Desktop billing selector: account menu -> Billing -> Personal or an Organization. Finish/stop active tasks and ongoing team responsibilities before changing the Desktop payer. This prevents queued specialists from crossing billing contexts.
8. VS Code: run `Blue: Choose Personal or Organization Billing` in the Command Palette. New tasks use the selection; existing leases keep their original payer. Teams remains Desktop-only.

## Existing settings
Keep the existing Supabase, payment, signing and OpenRouter settings. No new Redis database or Redis commands are introduced. The Worker now requires only its signing secret, inference key, Supabase URL and service-role key. Existing Redis secrets may remain for historical Portal cleanup; they are not used by new model calls. Invitation emails use the existing Resend/job-outbox setup; if enqueue fails the owner receives a shareable invitation link.

## Important accounting rules
- One member seat per 10 lifetime paid Organization credits; owner included. Spending credits does not remove seats.
- Pending invitations reserve seats for seven days; revocation frees them immediately. Already accepted invitations must be handled by removing the member instead.
- Member caps apply to lifetime settled spending plus reserved task budgets. A cap cannot be reduced below already spent/reserved credits.
- Removal blocks subsequent dispatches and extensions; already dispatched work still settles. Rejoining preserves spend/cap history.
- Task budgets are earmarked at admission/extension. The shared wallet is not locked for every model call. Model admission verifies the protected allocation, membership, cap, account rate limit and concurrency in one Postgres RPC.
- Usage observation and settlement remain separate durable operations. One admission trip does not mean one database operation for the whole task.
- BYOK inference remains direct and does not debit Organization credits.

## Verification and remaining live validation
Local full-schema tests cover the existing migration chain, payments, seats, invite revocation, caps, removal/rejoin, zero Redis flags, duplicate calls/settlement, task extensions, personal wallet isolation and migration reapplication. Worker tests use the real Workers runtime with synthetic upstream responses; live health and unauthenticated rejection pass without sending inference. Portal/Desktop builds and extension type checking are required on final source.

Organization end-to-end billing in your deployed database still needs the migration and two-account smoke test above. A real 50–80 concurrent-user staging load test has not been run; do not assume Supabase Free has demonstrated that capacity. This feature shares credits and access, not local project folders, private chats, SSO or enterprise SLAs.

## Pause or roll back
Set `BLUE_ORGANIZATIONS_ENABLED=false` to stop new Organization purchases/task admissions. Leave the schema and compatible settlement code installed so already admitted work can finish and release its holds. Do not downgrade to a Portal version predating Organization settlement while Organization tasks are pending.

## Temporary INR 1 PayU check
Set Vercel `BLUE_ORGANIZATION_PAYU_TEST_ENABLED=true` before deploying the Portal. Organization rollout must also be enabled. Sign in as verified `omnileshkarande@gmail.com`, open an Organization you own, select exactly 50 credits and INR. The admin checkout displays `Buy ₹1` and PayU receives INR 1.00. Other accounts, other quantities, personal purchases and USD/PayPal keep their normal prices. The signed, stored payment quote is marked as a live payment test and still settles exactly once into the Organization. No new SQL migration or Worker/Desktop update is required.

After the check, set `BLUE_ORGANIZATION_PAYU_TEST_ENABLED=false` and redeploy. Already created signed orders settle using their saved prices even after the flag is turned off. This flag alone does not change PayU sandbox/live credentials. No real payment has been submitted by Codex.

## Dashboard UX update
Organization and personal dashboards retain their current data during browser focus changes and silent authentication renewal. Organization snapshots update on entry, explicit mutations, payment return and manual Refresh. Billing records load on the first explicit visit to Billing & Ledger and refresh only when requested or after a related mutation.

`/organizations` resolves the most recently used valid membership directly to its admin dashboard. Only the Organization ID is remembered in browser storage, under an account-specific key; financial snapshots stay in memory and are cleared on account changes. The header switcher supports other memberships and New Organization. Owners see member/cap editing, invitation revocation and a bounded owner-only ledger endpoint. Personal account controls use the same restrained dashboard styling and a manual refresh action.

No additional migration, environment setting, Worker deployment or Desktop restart is required. Push/deploy the Portal changes normally. Screenshots were captured from the actual components with isolated sample data, not live account balances.
