const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface OpenRouterModel {
  id: string;
  canonical_slug?: string;
  /** Internal compatibility identifiers returned by older catalogue responses. */
  aliases?: string[];
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
    web_search?: string;
    internal_reasoning?: string;
    input_cache_read?: string;
    input_cache_write?: string;
    output_cache_read?: string;
  };
  supported_parameters?: string[];
  architecture?: Record<string, unknown>;
}

export interface BlueModel {
  id: string;
  upstreamModel: string;
  displayName: string;
  description: string;
  isFree: boolean;
  inputPrice: string;
  outputPrice: string;
  contextLength: number;
  supportedParameters: string[];
  highConsumption: boolean;
}

const TRIAL_MODEL_IDS = new Set([
  'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-v4-pro',
  'qwen/qwen3.7-plus',
  'z-ai/glm-5',
  'kwaipilot/kat-coder-air-v2.5',
  'poolside/laguna-s-2.1'
]);

let cache: { loadedAt: number; models: OpenRouterModel[] } | undefined;

export function openRouterApiKey(): string {
  return String(process.env.OPENROUTER_API_KEY || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim();
}

export async function getOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.models;
  const apiKey = openRouterApiKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`OpenRouter models request failed (${response.status})`);

  const payload = await response.json() as { data?: OpenRouterModel[] };
  const models = normalizeOpenRouterModels(Array.isArray(payload.data) ? payload.data : []);
  if (models.length === 0) throw new Error('OpenRouter returned an empty model catalog');
  cache = { loadedAt: Date.now(), models };
  return models;
}

/**
 * Provider catalogues can expose moving aliases in `id` (for example
 * `~vendor/model-latest`). Exact-model guardrails accept the permanent
 * `canonical_slug`, so Blue normalizes the catalogue before it is consumed.
 */
export function normalizeOpenRouterModels(models: OpenRouterModel[]): OpenRouterModel[] {
  const normalized = new Map<string, OpenRouterModel>();

  for (const raw of models) {
    const canonical = canonicalModelId(raw);
    if (!canonical) continue;

    const rawId = String(raw.id || '').trim();
    const aliases = new Set<string>([
      ...(raw.aliases || []).map(value => String(value || '').trim()),
      rawId
    ].filter(value => value && value !== canonical));
    const existing = normalized.get(canonical);
    for (const alias of existing?.aliases || []) aliases.add(alias);

    // If both entries exist, prefer the permanent record's metadata. The old
    // alias remains accepted only for restoring a previously saved selection.
    if (!existing || rawId === canonical) {
      normalized.set(canonical, {
        ...(existing || {}),
        ...raw,
        id: canonical,
        canonical_slug: canonical,
        aliases: Array.from(aliases)
      });
    } else {
      normalized.set(canonical, { ...existing, aliases: Array.from(aliases) });
    }
  }

  return Array.from(normalized.values());
}

export function canonicalModelId(
  model: Pick<OpenRouterModel, 'id' | 'canonical_slug'>
): string | undefined {
  const permanent = String(model.canonical_slug || '').trim();
  if (isProviderModelSlug(permanent)) return permanent;
  const id = String(model.id || '').trim();
  return isProviderModelSlug(id) ? id : undefined;
}

export function isProviderModelSlug(value: unknown): value is string {
  const model = String(value || '').trim();
  return model.length > 2
    && model.length <= 200
    && model.includes('/')
    && !model.startsWith('~')
    && !/\s/.test(model);
}

export function publicModel(model: OpenRouterModel): BlueModel {
  const modelId = canonicalModelId(model);
  if (!modelId) throw new Error('Blue model catalogue contains an invalid model identifier');
  const inputPerToken = price(model.pricing?.prompt);
  const outputPerToken = price(model.pricing?.completion);
  return {
    id: modelId,
    upstreamModel: modelId,
    displayName: model.name || modelId.split('/').at(-1) || modelId,
    description: publicBlueDescription(model.description),
    isFree: inputPerToken === 0 && outputPerToken === 0,
    inputPrice: (inputPerToken * 1_000_000).toFixed(6),
    outputPrice: (outputPerToken * 1_000_000).toFixed(6),
    contextLength: Math.max(0, Number(model.context_length || 0)),
    supportedParameters: model.supported_parameters || [],
    highConsumption: inputPerToken >= 0.000001 || outputPerToken >= 0.000004
  };
}

function publicBlueDescription(value: unknown): string {
  const description = String(value || 'Available through Blue.')
    .replace(/https?:\/\/openrouter\.ai\/[^\s"'<>)]*/gi, 'Blue')
    .replace(/\bOpenRouter\b/gi, 'Blue')
    .replace(/\bopenrouter\b/gi, 'Blue')
    .trim();
  return description || 'Available through Blue.';
}

export function modelsForAccess(models: OpenRouterModel[], accessTier: string): OpenRouterModel[] {
  if (accessTier === 'full') return models;
  return models.filter(model =>
    TRIAL_MODEL_IDS.has(canonicalModelId(model) || '') ||
    (price(model.pricing?.prompt) === 0 && price(model.pricing?.completion) === 0)
  );
}

export function resolveModel(models: OpenRouterModel[], requested: string): OpenRouterModel | undefined {
    const clean = String(requested || '').trim();
    if (!clean) return undefined;
    // Permanent identifiers are authoritative. Aliases are accepted only to
    // migrate a model selection saved from an older catalogue response.
    return models.find(model =>
      canonicalModelId(model) === clean ||
      (model.aliases || []).includes(clean)
    );
}

export function estimatePromptTokens(messages: unknown, tools: unknown): number {
  const characters = JSON.stringify({ messages, tools }).length;
  return Math.max(1, Math.ceil(characters / 3));
}

export function price(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function lowBalanceThreshold(lastTopUpCredits: number): number {
  return Math.max(0.15, Math.min(1.5, lastTopUpCredits * 0.2));
}

export function isLowBalance(balance: number, threshold: number): boolean {
  return balance > 0 && balance <= threshold;
}
