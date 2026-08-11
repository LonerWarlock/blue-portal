# Blue Direct OpenRouter Runtime deployment

The runtime endpoints are a control plane only. They must never receive prompts,
source code, tool output, conversation history, or project memory.

## Required production configuration

Set these server-only environment variables in Blue Portal:

- `OPENROUTER_MANAGEMENT_API_KEY`: an OpenRouter management key. Never use it for completions.
- `OPENROUTER_WORKSPACE_ID`: the workspace where task-scoped child keys and guardrails are created.
- `BLUE_RUNTIME_TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded as base64, or 64 hexadecimal characters.
- `CRON_SECRET`: a high-entropy bearer secret for reconciliation.
- `BLUE_DIRECT_RUNTIME_ENABLED`: set to `true` for new admissions; `false` is the kill switch.
- `BLUE_DIRECT_RUNTIME_USER_IDS`: optional comma-separated Supabase user IDs for a five-user canary.

Retain the existing `BLUE_CREDIT_MULTIPLIER`, Supabase, and legacy
`OPENROUTER_API_KEY` variables while old VSIX releases still use the proxy.

Generate the encryption key locally without printing or committing it:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Store the result directly in the deployment platform's encrypted environment
settings. Never place it in source control.

## Database and rollout order

1. Back up Supabase and apply `supabase/migrations/010_blue_direct_runtime.sql`.
2. Configure the required secrets with `BLUE_DIRECT_RUNTIME_ENABLED=false`.
3. Deploy Blue Portal and verify the legacy `/api/chat/completions` route still works.
4. Set `BLUE_DIRECT_RUNTIME_USER_IDS` to the first canary user and enable new admissions.
5. Install the matching V5 extension for that user and verify paid/free completion, Continue, Stop, restart recovery, and settlement.
6. Add the remaining users one at a time. Clear the allowlist only after every canary passes.

Disabling new admissions never disables GET, Continue, Complete, Delete, or the
reconciler for existing tasks. An active task is therefore never switched to the
legacy proxy.

## Operational checks

- Schedule `/api/cron/blue-runtime-reconcile` every five minutes with
  `Authorization: Bearer <CRON_SECRET>`.
- Alert on credential provisioning failures, reconciliation backlog over five
  minutes, OpenRouter management 429s, non-zero cost from a catalogued free
  model, duplicate-admission conflicts, and settlement failures.
- Never log request authorization headers or runtime credential response bodies.
- Keep the legacy proxy for two extension releases, then remove it only after
  adoption and settlement telemetry are stable.
