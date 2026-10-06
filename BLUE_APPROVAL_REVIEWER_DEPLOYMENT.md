# Separate approval reviewer

## Free reviewer compatibility update (2026-10-06)

The active Portal now supports the desktop's exact `qwen/qwen3.8-27b:free`
reviewer as well as explicitly requested legacy `openai/gpt-5.4-mini` reviews.
There is no automatic paid fallback. Free review requires verified zero pricing
and native structured-output/reasoning capabilities; it does not require coding
tools. The reviewer-only catalogue entry is not exposed as a coding model.

Free coding plus free review uses a zero-credit reservation. Paid coding and
legacy paid review retain their existing accounting, immutable task identity,
exact-model guardrails and concurrency limits. Apply additive migration
`028_blue_runtime_free_approval_reviewer.sql` after the existing runtime baseline,
then deploy the matching Portal source. No desktop package change is needed.
Provider/workspace availability and free endpoint rate limits still apply.

The sections below record the original paid-reviewer implementation. The separate
source snapshot under BlueV2 is only a patch artifact; do not copy its dependency
junction or package it.

## What changes

New clients may explicitly request `approval_reviewer_model` with the one
allowlisted value `openai/gpt-5.4-mini`. Omitted/null/empty means no separate
reviewer. Unknown reviewers, provider meta-routers and `:free` aliases are
rejected. This is a billable choice, not a silent fallback from the task model.

One reviewed task has one execution slot, one credit reservation and one
bounded managed key per credential rotation. That key allows exactly the
selected coding route and the approved reviewer (deduplicated if identical).
It never allows the entire model catalogue. A separate guardrail mapping avoids
widening existing single-model policies; exact workspace/model-set validation
and the child key's filtered catalogue are checked before returning the key.

The coding task's `is_free` / response `billing.free_model` still describe the
coding route. A paid reviewer makes the entire task billable even when coding
is free, so its hold, extensions, key limit and settlement include all provider
usage. Reviewer costs do not cause a free coding route to be blocked for an
apparent pricing mismatch. Authoritative managed-key usage is settled once at
the existing 1.5 Blue Credits per provider dollar multiplier; no second task
or second reviewer reservation is created. Trial's one-slot limit is unchanged.

Replay includes the reviewer in the payload hash, and SQL independently checks
the immutable reviewer binding. A same-request retry after its hold used the
wallet's final credits restores only the existing request allowance; it does
not reserve another hold. A changed binding/request identity returns a conflict.

Installed clients that omit the field still use the unchanged v2 admission
and unchanged single-model guardrails. Existing tasks receive a null reviewer
column, not a migrated billing choice. The queue scheduler and concurrency
limits are unchanged.

## Response contract

The existing coding `rate_card` stays unchanged. Reviewed responses add:

```json
{
  "credential": {
    "model": "selected/coding-route",
    "approval_reviewer_model": "openai/gpt-5.4-mini"
  },
  "billing": {
    "free_model": true,
    "billable_task": true
  },
  "approval_reviewer": {
    "model": "openai/gpt-5.4-mini",
    "rate_card": {
      "prompt": 0.00000075,
      "completion": 0.0000045,
      "request": 0,
      "cache_read": 0,
      "cache_write": 0,
      "reasoning": 0
    }
  }
}
```

The example rate card is illustrative; the response reads current verified
catalogue prices, including cache/reasoning/request prices when advertised.
No inference is performed during capability/key-filter verification. Reviewer
metadata must advertise tools, JSON response format, structured outputs and
reasoning/effort support; missing/unverified metadata fails closed. Metadata
alone is not proof that every live provider response will be valid.

## Deployment order

1. Review the nine changed/new files already present in the local Portal
   repository. Commit/push them yourself when ready; do not include dependencies,
   secrets, generated assets or unrelated files. If your branch auto-deploys,
   arrange the following database step before releasing updated clients.
2. Apply `supabase/migrations/025_blue_runtime_approval_reviewer.sql` after the
   existing runtime baseline/queue migrations. It adds a nullable constrained
   task column and service-role-only v3 RPC, retaining v2. It is retryable.
3. Deploy the matching Portal backend. Confirm old no-reviewer admission,
   GET/replay, stop, extension and settlement still work.
4. Before new clients use the field, confirm the fixed reviewer is available
   through Blue's actual OpenRouter workspace catalogue and the dual-model
   guardrail returns exactly the expected child-key catalogue. A public model
   listing alone is not an authenticated routing guarantee.
5. Release the client/native-host change with explicit reviewer cost consent,
   separate cost presentation and exact native policy/schema/parser retained.
   BYOK reviewer requests are billed by the user's provider; this backend
   patch governs Blue PAYG task credentials and Blue Credit settlement.
6. Run an explicitly approved small end-to-end reviewed PAYG task, including a
   free coding route, a paid coding route, a trial account, stop/retry and an
   allowance extension. Verify actual provider total costs against the one
   task's settlement. No paid end-to-end inference was run for this local patch.

A key-filtered model allowlist restricts routes and spending, not the purpose
of individual calls. The local native host must isolate its reviewer policy
and assessment from normal coding messages. Do not treat a task-scoped key as
proof that a caller used a particular model only for review.

If the reviewer is unavailable, returns an invalid assessment or loses
connectivity, stop the affected turn and offer explicit manual approval.
Never silently change the selected coding model, weaken the schema, auto-allow
an unreviewed action or promise that all provider outages can be eliminated.

## Files and verification

Changed/new backend files:

- `app/api/runtime/v1/tasks/route.ts`
- `lib/approvalReviewer.ts`
- `lib/blueRuntime.ts`
- `lib/openrouterManagement.ts`
- `supabase/migrations/025_blue_runtime_approval_reviewer.sql`
- `lib/approvalReviewer.test.mjs`
- `lib/approvalReviewerMigration.test.mjs`
- `package.json` (test script only)
- this deployment note

Commands:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
npm run test:approval-reviewer
```

The focused suite has 41 passing tests: reviewer allowlist/capabilities/pricing,
immutable replay, exact two-model guardrail/key catalogue, actual SQL migration
reapplication/v2 compatibility/trial slot/reservation/extension/settlement,
existing runtime contracts and usage accounting. PGlite runs the real SQL
baseline and RPCs locally; it is not a Supabase deployment confirmation.

The broader existing scaling suite has an unrelated failing static expectation
for an unconditional Meta Pixel in the layout, while the current UI is
consent-gated. This patch does not change that UI or its test.
