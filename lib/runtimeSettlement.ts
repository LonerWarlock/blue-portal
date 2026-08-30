export const DEFAULT_USAGE_SETTLEMENT_GRACE_MS = 30_000;
export const DEFAULT_ZERO_USAGE_SETTLEMENT_GRACE_MS = 120_000;
export const DEFAULT_USAGE_OBSERVATION_INTERVAL_MS = 5_000;
export const REQUIRED_STABLE_USAGE_OBSERVATIONS = 2;

export interface RuntimeUsageObservation {
  keyHash: string | null;
  state: 'provisioning' | 'active' | 'disabled' | 'deleted' | 'failed';
  usageStart: number;
  usageObserved: number | null;
  stableObservations: number;
}

export interface RuntimeSettlementDecisionInput {
  requestedAt: number;
  now: number;
  credentials: RuntimeUsageObservation[];
  usageGraceMs?: number;
  zeroUsageGraceMs?: number;
}

export interface RuntimeSettlementDecision {
  ready: boolean;
  providerCost: number;
  retryAfterSeconds: number;
  reason: 'ready' | 'credential-active' | 'usage-unobserved' | 'usage-unstable' | 'usage-grace';
}

export function nextStableUsageObservation(input: {
  previousUsage: number | null;
  previousStableObservations: number;
  previousObservedAt: number | null;
  observedUsage: number;
  now: number;
  minimumIntervalMs?: number;
}): { usage: number; stableObservations: number } {
  const usage = finiteNonNegative(input.observedUsage);
  const previous = input.previousUsage === null ? null : finiteNonNegative(input.previousUsage);
  const minimumInterval = positiveInteger(
    input.minimumIntervalMs,
    DEFAULT_USAGE_OBSERVATION_INTERVAL_MS
  );
  const separated = input.previousObservedAt === null
    || input.now - input.previousObservedAt >= minimumInterval;

  if (previous === null) return { usage, stableObservations: 1 };
  if (usage > previous + 0.000000000001) return { usage, stableObservations: 1 };
  if (!separated) {
    return {
      usage: Math.max(previous, usage),
      stableObservations: Math.max(1, Math.trunc(input.previousStableObservations || 0))
    };
  }
  return {
    usage: Math.max(previous, usage),
    stableObservations: Math.max(1, Math.trunc(input.previousStableObservations || 0)) + 1
  };
}

export function decideRuntimeSettlement(input: RuntimeSettlementDecisionInput): RuntimeSettlementDecision {
  const providerCredentials = input.credentials.filter(credential => Boolean(credential.keyHash));
  if (providerCredentials.length === 0) {
    return { ready: true, providerCost: 0, retryAfterSeconds: 0, reason: 'ready' };
  }
  if (providerCredentials.some(credential => credential.state === 'active' || credential.state === 'provisioning')) {
    return pending('credential-active', 5, providerCost(providerCredentials));
  }
  if (providerCredentials.some(credential => credential.usageObserved === null)) {
    return pending('usage-unobserved', 5, providerCost(providerCredentials));
  }

  const cost = providerCost(providerCredentials);
  if (providerCredentials.some(credential =>
    credential.state !== 'deleted'
    && credential.stableObservations < REQUIRED_STABLE_USAGE_OBSERVATIONS
  )) {
    return pending('usage-unstable', 5, cost);
  }

  const grace = cost > 0
    ? positiveInteger(input.usageGraceMs, DEFAULT_USAGE_SETTLEMENT_GRACE_MS)
    : positiveInteger(input.zeroUsageGraceMs, DEFAULT_ZERO_USAGE_SETTLEMENT_GRACE_MS);
  const remaining = Math.max(0, grace - Math.max(0, input.now - input.requestedAt));
  if (remaining > 0) {
    return pending('usage-grace', Math.max(1, Math.min(30, Math.ceil(remaining / 1000))), cost);
  }
  return { ready: true, providerCost: cost, retryAfterSeconds: 0, reason: 'ready' };
}

function providerCost(credentials: RuntimeUsageObservation[]): number {
  return roundProvider(credentials.reduce((total, credential) => {
    const start = finiteNonNegative(credential.usageStart);
    const observed = Math.max(start, finiteNonNegative(credential.usageObserved));
    return total + observed - start;
  }, 0));
}

function pending(
  reason: RuntimeSettlementDecision['reason'],
  retryAfterSeconds: number,
  cost: number
): RuntimeSettlementDecision {
  return { ready: false, providerCost: cost, retryAfterSeconds, reason };
}

function finiteNonNegative(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function roundProvider(value: number): number {
  return Number(Math.max(0, value).toFixed(12));
}
