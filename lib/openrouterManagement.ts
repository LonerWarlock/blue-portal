import { randomUUID } from 'node:crypto';
import accountCatalogue from './openrouterAccountModels.cjs';

const OPENROUTER_MANAGEMENT_BASE = 'https://openrouter.ai/api/v1';

export interface OpenRouterManagedKey {
  hash: string;
  usage: number;
  limit: number | null;
  limit_remaining: number | null;
  disabled: boolean;
  expires_at: string | null;
}

export interface CreatedOpenRouterKey {
  key: string;
  data: OpenRouterManagedKey;
}

interface OpenRouterGuardrail {
  id: string;
  workspace_id?: string;
  allowed_models: string[] | null;
}

interface OpenRouterKeyModel {
  id?: string;
  canonical_slug?: string;
}

function managementKey(): string {
  const value = String(process.env.OPENROUTER_MANAGEMENT_API_KEY || '')
    .trim()
    .replace(/^Bearer\s+/i, '');
  if (!value) throw new Error('OPENROUTER_MANAGEMENT_API_KEY is not configured');
  return value;
}

export function openRouterWorkspaceId(): string {
  const value = String(process.env.OPENROUTER_WORKSPACE_ID || '').trim();
  if (!value) throw new Error('OPENROUTER_WORKSPACE_ID is not configured');
  return value;
}

async function managementRequest<T>(
  path: string,
  init: RequestInit = {},
  attempts = 3
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${OPENROUTER_MANAGEMENT_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${managementKey()}`,
          'Content-Type': 'application/json',
          ...(init.headers || {})
        },
        cache: 'no-store',
        signal: init.signal || AbortSignal.timeout(10_000)
      });
    } catch (error) {
      lastError = error instanceof Error
        ? new Error(`OpenRouter management connection failed: ${error.message}`)
        : new Error('OpenRouter management connection failed');
      if (attempt === attempts) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(4_000, 350 * (2 ** (attempt - 1)))));
      continue;
    }
    if (response.ok) return await response.json() as T;

    const retryAfter = Number(response.headers.get('retry-after') || 0);
    const message = await safeErrorMessage(response);
    const error = new Error(`OpenRouter management request failed (${response.status}): ${message}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    lastError = error;
    const retryable = response.status === 429 || response.status === 502
      || response.status === 503 || response.status === 504;
    if (!retryable || attempt === attempts) break;
    const delayMs = retryAfter > 0
      ? Math.min(30_000, retryAfter * 1000)
      : Math.min(4_000, 350 * (2 ** (attempt - 1)));
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw lastError || new Error('OpenRouter management request failed');
}

export async function createManagedKey(input: {
  name: string;
  limit?: number | null;
  expiresAt: string;
}): Promise<CreatedOpenRouterKey> {
  return managementRequest<CreatedOpenRouterKey>('/keys', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      limit: input.limit ?? null,
      limit_reset: null,
      expires_at: input.expiresAt,
      workspace_id: openRouterWorkspaceId()
    })
  }, 1);
}

export async function getManagedKey(hash: string): Promise<OpenRouterManagedKey> {
  const payload = await managementRequest<{ data: OpenRouterManagedKey }>(`/keys/${encodeURIComponent(hash)}`);
  return payload.data;
}

export async function updateManagedKey(
  hash: string,
  patch: { disabled?: boolean; limit?: number; name?: string }
): Promise<OpenRouterManagedKey> {
  const payload = await managementRequest<{ data: OpenRouterManagedKey }>(`/keys/${encodeURIComponent(hash)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  return payload.data;
}

export async function deleteManagedKey(hash: string): Promise<void> {
  try {
    await managementRequest<{ deleted: boolean }>(`/keys/${encodeURIComponent(hash)}`, {
      method: 'DELETE'
    });
  } catch (error) {
    if (Number((error as { status?: number })?.status) !== 404) throw error;
  }
}

const MODEL_POLICY_PATH = '/guardrails/policies/model-availability';
export const RUNTIME_MODEL_POLICY_PREFIX = 'model-policy:';

/** Create the exact allowlist and attach its single temporary key in one provider operation. */
export async function createAssignedRuntimeModelPolicy(models: string[], keyHash: string): Promise<string> {
  const allowedModels = exactModelSet(models);
  const { data } = await managementRequest<{ data: { id: string } }>(MODEL_POLICY_PATH, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Blue runtime ' + randomUUID(),
      workspace_id: openRouterWorkspaceId(),
      policy_type: 'model_availability',
      config: { allowed_models: allowedModels },
      api_key_hashes: [keyHash]
    })
  }, 1);
  if (!/^[0-9a-f-]{36}$/i.test(data?.id || '')) throw new Error('OpenRouter did not return a model policy ID');
  return RUNTIME_MODEL_POLICY_PREFIX + data.id;
}

export async function assertRuntimeModelPolicyAssigned(reference: string, keyHash: string): Promise<void> {
  const policyId = reference.slice(RUNTIME_MODEL_POLICY_PREFIX.length);
  const query = new URLSearchParams({ workspace_id: openRouterWorkspaceId(), policy_type: 'model_availability' });
  const path = '/guardrails/policies/assignments/api-keys/' + encodeURIComponent(keyHash) + '?' + query;
  for (const delay of [0, 350, 900]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const { data } = await managementRequest<{ data: { policy_ids?: string[]; opted_out?: boolean } }>(path);
    if (data?.policy_ids?.length === 1 && data.policy_ids[0] === policyId && data.opted_out === false) return;
  }
  throw new Error('OpenRouter did not confirm the exact model policy for the temporary key');
}

export async function deleteRuntimeModelPolicy(reference: string | null): Promise<void> {
  // Unprefixed IDs are legacy, shared guardrails. A single task cannot delete one.
  if (!reference?.startsWith(RUNTIME_MODEL_POLICY_PREFIX)) return;
  const id = reference.slice(RUNTIME_MODEL_POLICY_PREFIX.length);
  const path = MODEL_POLICY_PATH + '/' + encodeURIComponent(id) + '?workspace_id=' + encodeURIComponent(openRouterWorkspaceId());
  try {
    await managementRequest(path, { method: 'DELETE' });
  } catch (error) {
    if (Number((error as { status?: number })?.status) !== 404) throw error;
  }
}

export async function createModelGuardrail(model: string): Promise<string> {
  return createModelSetGuardrail([model]);
}

function exactModelSet(models: string[]): string[] {
  const selected = Array.from(new Set(models.map(requireCanonicalModelSlug))).sort();
  if (selected.length < 1 || selected.length > 2) throw new Error('Blue credentials require one or two exact models');
  return selected;
}

export async function createModelSetGuardrail(models: string[]): Promise<string> {
  const selectedModels = exactModelSet(models);
  // A guardrail name identifies one policy instance, not the model. The old
  // deterministic name collides when a DB mapping is stale, an earlier policy
  // was orphaned, or two requests provision the same model concurrently.
  // Keep the random suffix even when the model slug is near the name limit.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const suffix = randomUUID();
    const name = `${`Blue model ${selectedModels.join(' + ')}`.slice(0, 200 - suffix.length - 1)}-${suffix}`;
    try {
      const payload = await managementRequest<{ data: { id: string } }>('/guardrails', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: 'Blue runtime exact-model credential guardrail.',
          allowed_models: selectedModels,
          allowed_providers: null,
          workspace_id: openRouterWorkspaceId()
        })
      }, 1);
      if (!payload.data?.id) throw new Error('OpenRouter did not return a guardrail ID');
      return payload.data.id;
    } catch (error) {
      if (Number((error as { status?: number })?.status) !== 409 || attempt === 2) throw error;
    }
  }
  throw new Error('OpenRouter could not create a unique model guardrail');
}

/** Read-only validation: never mutate a guardrail that may still protect live keys. */
export async function exactModelGuardrailMatches(guardrailId: string, model: string): Promise<boolean> {
  return exactModelSetGuardrailMatches(guardrailId, [model]);
}

export async function exactModelSetGuardrailMatches(guardrailId: string, models: string[]): Promise<boolean> {
  const selectedModels = exactModelSet(models);
  let guardrail: OpenRouterGuardrail;
  try {
    const payload = await managementRequest<{ data: OpenRouterGuardrail }>(
      `/guardrails/${encodeURIComponent(guardrailId)}`
    );
    guardrail = payload.data;
  } catch (error) {
    if (Number((error as { status?: number })?.status) === 404) return false;
    throw error;
  }

  return guardrail.workspace_id === openRouterWorkspaceId()
    && guardrail.allowed_models?.length === selectedModels.length
    && new Set(guardrail.allowed_models).size === selectedModels.length
    && selectedModels.every(model => guardrail.allowed_models!.includes(model));
}

/**
 * Assignment can be eventually consistent. Verify the short-lived child key
 * against OpenRouter's key-filtered catalogue before Blue returns it to a PC.
 * This endpoint performs no inference and therefore consumes no model credit.
 */
export async function assertManagedKeyCanUseModel(
  key: string,
  model: string,
  aliases: string[] = []
): Promise<void> {
  return assertManagedKeyCanUseModelSet(key, [{ model, aliases }]);
}

export async function assertManagedKeyCanUseModelSet(
  key: string,
  models: { model: string; aliases?: string[] }[]
): Promise<void> {
  const canonicalModels = exactModelSet(models.map(value => value.model));
  const acceptedGroups = canonicalModels.map(model => new Set([model, ...models
    .filter(value => value.model === model).flatMap(value => value.aliases || [])]
    .map(value => String(value || '').trim())
    .filter(value => value && !value.startsWith('~') && !value.toLowerCase().startsWith('openrouter/')
      && (value.match(/:[^/:]+$/)?.[0] || '') === (model.match(/:[^/:]+$/)?.[0] || ''))));
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let scopeUnverified = false;
    try {
      const rows = await accountCatalogue.accountModelRows(key) as OpenRouterKeyModel[];
      const availableModels = new Set(rows.map(candidate => String(candidate.id || candidate.canonical_slug || '').trim()).filter(Boolean));
      const available = Array.from(availableModels);
      const hasSelectedModel = acceptedGroups.every(group => available.some(candidate => group.has(candidate)));
      const exactGroups = acceptedGroups.every(group => available.filter(candidate => group.has(candidate)).length === 1)
        && available.every(candidate => acceptedGroups.filter(group => group.has(candidate)).length === 1);
      if (availableModels.size === canonicalModels.length && hasSelectedModel && exactGroups) return;
      scopeUnverified = hasSelectedModel;
      lastError = new Error(hasSelectedModel
        ? 'The temporary provider credential is not restricted to the selected model'
        : 'The temporary provider credential cannot access the selected model');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('OpenRouter credential verification failed');
    }
    // A newly assigned key can briefly show a broader catalogue. Recheck the
    // same key once more without changing its policy or admitting the task.
    if (attempt === 4 || (attempt === 3 && !scopeUnverified)) break;
    await new Promise(resolve => setTimeout(resolve, attempt === 3 ? 1_250 : attempt * 250));
  }
  throw lastError || new Error('The temporary provider credential cannot access the selected model');
}

function requireCanonicalModelSlug(value: string): string {
  const model = String(value || '').trim();
  if (
    model.length <= 2 ||
    model.length > 200 ||
    !model.includes('/') ||
    model.startsWith('~') ||
    model.toLowerCase().startsWith('openrouter/') ||
    /\s/.test(model)
  ) {
    throw new Error('Blue model catalogue did not provide a canonical model identifier');
  }
  return model;
}

export async function assignKeyGuardrail(guardrailId: string, keyHash: string,
  repairMissing?: (missingId: string) => Promise<string>): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await managementRequest<{ assigned_count: number }>(
        `/guardrails/${encodeURIComponent(guardrailId)}/assignments/keys`,
        { method: 'POST', body: JSON.stringify({ key_hashes: [keyHash] }) }
      );
      if (result.assigned_count !== 1) throw new Error('OpenRouter did not confirm the temporary key guardrail assignment');
      return;
    } catch (error) {
      // Only an identified missing policy may be repaired. Never substitute
      // an unrestricted credential, retry unknown writes, or mask auth errors.
      if (attempt || !repairMissing || Number((error as { status?: number })?.status) !== 404
        || !/guardrail.{0,60}(?:not found|does not exist)/i.test(String((error as Error)?.message || ''))) throw error;
      const replacement = await repairMissing(guardrailId);
      if (!replacement || replacement === guardrailId) throw new Error('Blue could not replace the missing model guardrail');
      guardrailId = replacement;
    }
  }
}

export async function deleteGuardrail(guardrailId: string): Promise<void> {
  try {
    await managementRequest<Record<string, unknown>>(`/guardrails/${encodeURIComponent(guardrailId)}`, {
      method: 'DELETE'
    });
  } catch (error) {
    if (Number((error as { status?: number })?.status) !== 404) throw error;
  }
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string | { message?: string }; message?: string };
    if (typeof payload.error === 'string') return payload.error.slice(0, 400);
    if (payload.error?.message) return payload.error.message.slice(0, 400);
    if (payload.message) return payload.message.slice(0, 400);
  } catch {}
  return response.statusText || 'Unknown management error';
}
