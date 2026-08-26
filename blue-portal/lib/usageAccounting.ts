export interface UsageData {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  reasoning_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  cache_output_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number; cached_tokens?: number };
}

export interface UsagePricing {
  prompt: number;
  completion: number;
  request: number;
  cacheRead: number;
  cacheWrite: number;
  cacheOutput: number;
  reasoning: number;
  free: boolean;
}

export function normalizedUsage(
  usage: UsageData | undefined,
  estimatedPromptTokens: number,
  completionCharacters: number,
  pricing: UsagePricing
) {
  const promptTokens = Math.max(0, Number(usage?.prompt_tokens || estimatedPromptTokens));
  const completionTokens = Math.max(0, Number(usage?.completion_tokens || Math.ceil(completionCharacters / 3)));
  const reasoningTokens = Math.max(0, Number(
    usage?.completion_tokens_details?.reasoning_tokens || usage?.reasoning_tokens || 0
  ));
  const cacheReadTokens = Math.max(0, Number(
    usage?.prompt_tokens_details?.cached_tokens || usage?.cache_read_tokens || 0
  ));
  const cacheWriteTokens = Math.max(0, Number(
    usage?.prompt_tokens_details?.cache_write_tokens || usage?.cache_write_tokens || 0
  ));
  const cacheOutputTokens = Math.max(0, Number(
    usage?.completion_tokens_details?.cached_tokens || usage?.cache_output_tokens || 0
  ));
  const reportedCost = Number(usage?.cost);
  const providerReported = Number.isFinite(reportedCost) && reportedCost >= 0;
  const uncachedPromptTokens = Math.max(0, promptTokens - cacheReadTokens);
  const standardCompletionTokens = Math.max(0, completionTokens - reasoningTokens - cacheOutputTokens);
  const cost = pricing.free
    ? 0
    : providerReported
      ? reportedCost
      : uncachedPromptTokens * pricing.prompt
        + cacheReadTokens * (pricing.cacheRead || pricing.prompt)
        + cacheWriteTokens * pricing.cacheWrite
        + cacheOutputTokens * (pricing.cacheOutput || pricing.completion)
        + standardCompletionTokens * pricing.completion
        + reasoningTokens * (pricing.reasoning || pricing.completion)
        + pricing.request;
  return {
    promptTokens,
    completionTokens,
    reasoningTokens,
    cacheReadTokens,
    cacheWriteTokens,
    cacheOutputTokens,
    totalTokens: Math.max(Number(usage?.total_tokens || 0), promptTokens + completionTokens),
    cost,
    costSource: pricing.free ? 'free-model' as const : providerReported ? 'provider' as const : 'rate-card' as const,
    providerReported
  };
}
