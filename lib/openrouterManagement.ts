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
    const response = await fetch(`${OPENROUTER_MANAGEMENT_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${managementKey()}`,
        'Content-Type': 'application/json',
        ...(init.headers || {})
      },
      cache: 'no-store',
      signal: init.signal || AbortSignal.timeout(10_000)
    });
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
  });
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

export async function createModelGuardrail(model: string): Promise<string> {
  const canonicalModel = requireCanonicalModelSlug(model);
  const payload = await managementRequest<{ data: { id: string } }>('/guardrails', {
    method: 'POST',
    body: JSON.stringify({
      name: `Blue model ${canonicalModel}`.slice(0, 200),
      description: 'Blue runtime exact-model credential guardrail.',
      allowed_models: [canonicalModel],
      allowed_providers: null,
      workspace_id: openRouterWorkspaceId()
    })
  });
  if (!payload.data?.id) throw new Error('OpenRouter did not return a guardrail ID');
  return payload.data.id;
}

function requireCanonicalModelSlug(value: string): string {
  const model = String(value || '').trim();
  if (
    model.length <= 2 ||
    model.length > 200 ||
    !model.includes('/') ||
    model.startsWith('~') ||
    /\s/.test(model)
  ) {
    throw new Error('Blue model catalogue did not provide a canonical model identifier');
  }
  return model;
}

export async function assignKeyGuardrail(guardrailId: string, keyHash: string): Promise<void> {
  await managementRequest<{ assigned_count: number }>(
    `/guardrails/${encodeURIComponent(guardrailId)}/assignments/keys`,
    {
      method: 'POST',
      body: JSON.stringify({ key_hashes: [keyHash] })
    }
  );
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
