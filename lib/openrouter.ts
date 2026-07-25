const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface OpenRouterModel {
  id: string;
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
  const models = Array.isArray(payload.data) ? payload.data : [];
  if (models.length === 0) throw new Error('OpenRouter returned an empty model catalog');
  cache = { loadedAt: Date.now(), models };
  return models;
}

export function publicModel(model: OpenRouterModel): BlueModel {
  const inputPerToken = price(model.pricing?.prompt);
  const outputPerToken = price(model.pricing?.completion);
  return {
    id: model.id,
    upstreamModel: model.id,
    displayName: model.name || model.id.split('/').at(-1) || model.id,
    description: model.description || 'Available through the Blue OpenRouter gateway.',
    isFree: inputPerToken === 0 && outputPerToken === 0,
    inputPrice: (inputPerToken * 1_000_000).toFixed(6),
    outputPrice: (outputPerToken * 1_000_000).toFixed(6),
    contextLength: Math.max(0, Number(model.context_length || 0)),
    supportedParameters: model.supported_parameters || [],
    highConsumption: inputPerToken >= 0.000001 || outputPerToken >= 0.000004
  };
}

export function modelsForAccess(models: OpenRouterModel[], accessTier: string): OpenRouterModel[] {
  const paid = models.filter(model => price(model.pricing?.prompt) > 0 || price(model.pricing?.completion) > 0);
  if (accessTier === 'full') return paid;
  return paid.filter(model => TRIAL_MODEL_IDS.has(model.id));
}

export function resolveModel(models: OpenRouterModel[], requested: string): OpenRouterModel | undefined {
  const clean = String(requested || '').trim();
  if (!clean) return undefined;
  const exact = models.find(model => model.id === clean);
  if (exact) return exact;
  const suffix = clean.includes('/') ? clean : `/${clean}`;
  const matches = models.filter(model => model.id.endsWith(suffix));
  return matches.length === 1 ? matches[0] : undefined;
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
