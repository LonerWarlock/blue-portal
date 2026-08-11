import { createHash } from 'crypto';
import { BluePaygAccount, BLUE_CREDIT_MULTIPLIER, releaseUsage, settleUsage, statusError } from '@/lib/bluePayg';
import { decryptRuntimeSecret, encryptRuntimeSecret } from '@/lib/blueRuntimeCrypto';
import {
  assignKeyGuardrail,
  createManagedKey,
  createModelGuardrail,
  deleteGuardrail,
  deleteManagedKey,
  getManagedKey,
  updateManagedKey
} from '@/lib/openrouterManagement';
import { getOpenRouterModels, modelsForAccess, price, publicModel, resolveModel } from '@/lib/openrouter';
import {
  decideRuntimeSettlement,
  DEFAULT_USAGE_OBSERVATION_INTERVAL_MS,
  DEFAULT_USAGE_SETTLEMENT_GRACE_MS,
  DEFAULT_ZERO_USAGE_SETTLEMENT_GRACE_MS,
  nextStableUsageObservation
} from '@/lib/runtimeSettlement';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const BLUE_RUNTIME_NORMAL_ALLOWANCE = 0.20;
export const BLUE_RUNTIME_UI_MAX_ALLOWANCE = 0.35;
export const BLUE_RUNTIME_EXTENSION_ALLOWANCE = 0.20;
export const BLUE_RUNTIME_CREDENTIAL_MINUTES = 60;
export const BLUE_RUNTIME_ROTATION_WINDOW_MS = 5 * 60 * 1000;

const MIN_PAID_ALLOWANCE = 0.01;
const FREE_PROVIDER_CEILING = 0.001;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const USAGE_SETTLEMENT_GRACE_MS = positiveDuration(
  process.env.BLUE_RUNTIME_USAGE_SETTLEMENT_GRACE_MS,
  DEFAULT_USAGE_SETTLEMENT_GRACE_MS
);
const ZERO_USAGE_SETTLEMENT_GRACE_MS = positiveDuration(
  process.env.BLUE_RUNTIME_ZERO_USAGE_SETTLEMENT_GRACE_MS,
  DEFAULT_ZERO_USAGE_SETTLEMENT_GRACE_MS
);
const USAGE_OBSERVATION_INTERVAL_MS = positiveDuration(
  process.env.BLUE_RUNTIME_USAGE_OBSERVATION_INTERVAL_MS,
  DEFAULT_USAGE_OBSERVATION_INTERVAL_MS
);

type RuntimeMode = 'normal' | 'ui_max';
type RuntimeTaskState = 'provisioning' | 'active' | 'stopping' | 'completed' | 'failed' | 'expired';

interface RuntimeTaskRow {
  request_id: string;
  user_id: string;
  device_hash: string;
  payload_hash: string;
  model: string;
  mode: RuntimeMode;
  is_free: boolean;
  access_tier: 'trial' | 'full';
  state: RuntimeTaskState;
  reserved_blue_credits: number | string;
  charged_blue_credits: number | string;
  balance_after: number | string | null;
  provider_cost: number | string;
  prompt_tokens: number | string;
  completion_tokens: number | string;
  client_provider_cost_hint: number | string;
  settlement_requested_at: string | null;
  settlement_next_attempt_at: string | null;
  settlement_attempts: number | string;
  terminal_reason: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

interface RuntimeCredentialRow {
  id: string;
  request_id: string;
  key_hash: string | null;
  encrypted_key: string | null;
  encryption_iv: string | null;
  encryption_tag: string | null;
  encryption_version: 'v1' | null;
  guardrail_id: string | null;
  provider_limit: number | string;
  provider_usage_start: number | string;
  provider_usage_final: number | string | null;
  usage_observed_at: string | null;
  usage_stable_observations: number | string;
  state: 'provisioning' | 'active' | 'disabled' | 'deleted' | 'failed';
  expires_at: string;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
  deleted_at: string | null;
}

export interface BlueRuntimeAdmissionInput {
  requestId: string;
  model: string;
  mode: RuntimeMode;
  requestedCreditCeiling?: number;
  clientVersion: string;
  deviceId: string;
}

export interface BlueRuntimeCredential {
  token: string;
  expires_at: string;
  base_url: typeof OPENROUTER_BASE_URL;
  model: string;
}

export interface BlueRuntimeAdmission {
  request_id: string;
  state: RuntimeTaskState;
  credential?: BlueRuntimeCredential;
  billing: {
    reserved_blue_credits: number;
    remaining_blue_credits: number;
    provider_limit: number;
    extension_blue_credits: number;
    multiplier: number;
    free_model: boolean;
  };
  rate_card: {
    prompt: number;
    completion: number;
    request: number;
    cache_read: number;
    cache_write: number;
    reasoning: number;
  };
}

export interface BlueRuntimeSettlement {
  request_id: string;
  state: 'completed' | 'failed' | 'expired';
  reserved_blue_credits: number;
  charged_blue_credits: number;
  refunded_blue_credits: number;
  provider_cost: number;
  remaining_blue_credits: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface BlueRuntimeSettlementPending {
  request_id: string;
  state: 'stopping';
  settlement_pending: true;
  reserved_blue_credits: number;
  remaining_blue_credits: number;
  provisional_provider_cost: number;
  retry_after_seconds: number;
}

export type BlueRuntimeFinalization = BlueRuntimeSettlement | BlueRuntimeSettlementPending;

export interface RuntimeClientUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  provider_cost?: number;
}

export async function admitBlueRuntimeTask(
  account: BluePaygAccount,
  input: BlueRuntimeAdmissionInput
): Promise<BlueRuntimeAdmission> {
  assertConfigured();
  validateAdmissionInput(input);
  await reconcileBlueRuntimeTasks({ userId: account.userId, limit: 20 });
  const refreshedAccount = await loadBillingAccount(account.userId, account.threshold);
  const availableModels = modelsForAccess(await getOpenRouterModels(), refreshedAccount.accessTier);
  const model = resolveModel(availableModels, input.model);
  if (!model) {
    throw statusError(400, refreshedAccount.accessTier === 'trial'
      ? 'This model is not included in the Blue Starter catalogue'
      : 'The selected Blue model is unavailable');
  }
  if (await isRuntimeModelBlocked(model.id)) {
    throw statusError(503, 'This model is temporarily unavailable while Blue verifies its provider pricing');
  }

  const publicInfo = publicModel(model);
  const modeDefault = input.mode === 'ui_max'
    ? BLUE_RUNTIME_UI_MAX_ALLOWANCE
    : BLUE_RUNTIME_NORMAL_ALLOWANCE;
  const requested = finitePositive(input.requestedCreditCeiling)
    ? Math.min(modeDefault, Number(input.requestedCreditCeiling))
    : modeDefault;
  const requestedCeiling = roundCredits(requested);
  const allowance = publicInfo.isFree
    ? 0
    : roundCredits(Math.min(requested, refreshedAccount.balance));
  if (!publicInfo.isFree && allowance < MIN_PAID_ALLOWANCE) {
    throw statusError(402, 'Your Blue Credits are too low to start another provider turn');
  }

  const deviceHash = sha256(input.deviceId);
  const payloadHash = sha256(stableJson({
    requestId: input.requestId,
    model: model.id,
    mode: input.mode,
    requestedCeiling,
    clientVersion: input.clientVersion,
    deviceHash
  }));
  const expiresAt = credentialExpiry();
  const { data, error } = await supabaseAdmin!.rpc('admit_blue_runtime_task', {
    user_id_param: refreshedAccount.userId,
    request_id_param: input.requestId,
    device_hash_param: deviceHash,
    payload_hash_param: payloadHash,
    model_param: model.id,
    mode_param: input.mode,
    is_free_param: publicInfo.isFree,
    access_tier_param: refreshedAccount.accessTier,
    amount_param: allowance,
    concurrency_limit_param: refreshedAccount.accessTier === 'trial' ? 1 : 3,
    expires_at_param: expiresAt
  });
  if (error) throw mapDatabaseError(error.message);
  if (data?.conflict === true) {
    throw statusError(409, 'This Blue task ID was already used with different runtime settings');
  }

  const task = await getTaskForUser(refreshedAccount.userId, input.requestId);
  if (!task && data?.accepted === false) {
    throw statusError(409, 'Blue could not safely recover this task admission. Start a new task; no additional credits were reserved.');
  }
  if (!task) throw statusError(500, 'Blue runtime admission was not persisted');
  const remaining = Number(data?.remaining ?? (await walletBalance(refreshedAccount.userId)));
  if (isTerminal(task.state)) {
    return admissionPayload(task, undefined, remaining, model);
  }
  if (task.state === 'stopping') {
    throw statusError(409, 'This Blue runtime task is already stopping and cannot be replayed');
  }

  const active = await getActiveCredential(task.request_id);
  if (active && active.encrypted_key && Date.parse(active.expires_at) - Date.now() > BLUE_RUNTIME_ROTATION_WINDOW_MS) {
    return admissionPayload(task, decryptCredential(active), remaining, model);
  }

  if (active?.state === 'provisioning') {
    return admissionPayload(task, undefined, remaining, model);
  }
  const credential = await provisionCredential(task);
  return admissionPayload(task, credential, remaining, model);
}

/** Kill switches apply only to brand-new admissions; replay and settlement stay available. */
export async function assertBlueRuntimeAdmissionEnabled(userId: string, requestId: string): Promise<void> {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');
  const { data } = await supabaseAdmin
    .from('blue_runtime_tasks')
    .select('request_id')
    .eq('request_id', requestId)
    .eq('user_id', userId)
    .maybeSingle();
  if (data?.request_id) return;
  if (String(process.env.BLUE_DIRECT_RUNTIME_ENABLED || 'true').toLowerCase() === 'false') {
    throw statusError(503, 'New Blue direct-runtime tasks are temporarily paused');
  }
  const allowlist = String(process.env.BLUE_DIRECT_RUNTIME_USER_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(userId)) {
    throw statusError(403, 'Blue direct runtime is not enabled for this account yet');
  }
}

export async function getBlueRuntimeTask(
  account: BluePaygAccount,
  requestId: string,
  deviceId: string
): Promise<BlueRuntimeAdmission | BlueRuntimeSettlement> {
  assertConfigured();
  const task = await getTaskForUser(account.userId, requestId);
  if (!task) throw statusError(404, 'Blue runtime task not found');
  if (task.device_hash !== sha256(deviceId)) throw statusError(403, 'This Blue runtime belongs to another device');
  if (isTerminal(task.state)) return existingSettlement(task, await walletBalance(account.userId));
  if (task.state === 'stopping') throw statusError(409, 'This Blue runtime task is being settled');

  const model = resolveModel(await getOpenRouterModels(), task.model);
  if (!model) throw statusError(503, 'The selected Blue model is no longer available');
  let active = await getActiveCredential(requestId);
  if (active?.state === 'active' && Date.parse(active.expires_at) - Date.now() <= BLUE_RUNTIME_ROTATION_WINDOW_MS) {
    await disableAndObserveCredential(active);
    await extendRuntimeExpiry(task.request_id);
    active = undefined;
  }
  if (!active || active.state !== 'active' || !active.encrypted_key) {
    const credential = await provisionCredential(await requireTask(account.userId, requestId));
    return admissionPayload(await requireTask(account.userId, requestId), credential, await walletBalance(account.userId), model);
  }
  return admissionPayload(task, decryptCredential(active), await walletBalance(account.userId), model);
}

export async function extendBlueRuntimeTask(
  account: BluePaygAccount,
  requestId: string,
  deviceId: string,
  extensionId: string
): Promise<BlueRuntimeAdmission> {
  assertConfigured();
  const task = await requireTask(account.userId, requestId);
  if (task.device_hash !== sha256(deviceId)) throw statusError(403, 'This Blue runtime belongs to another device');
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(extensionId)) {
    throw statusError(400, 'Invalid Blue runtime extension ID');
  }
  if (task.is_free) {
    const model = resolveModel(await getOpenRouterModels(), task.model);
    if (!model) throw statusError(503, 'The selected Blue model is no longer available');
    const credential = await activeOrProvision(task);
    return admissionPayload(task, credential, await walletBalance(account.userId), model);
  }

  const refreshed = await loadBillingAccount(account.userId, account.threshold);
  const amount = roundCredits(Math.min(BLUE_RUNTIME_EXTENSION_ALLOWANCE, refreshed.balance));
  if (amount < MIN_PAID_ALLOWANCE) throw statusError(402, 'Your Blue Credits are too low to continue this task');
  const expiresAt = credentialExpiry();
  const { data, error } = await supabaseAdmin!.rpc('extend_blue_runtime_task', {
    user_id_param: account.userId,
    request_id_param: requestId,
    extension_id_param: extensionId,
    amount_param: amount,
    expires_at_param: expiresAt
  });
  if (error) throw mapDatabaseError(error.message);

  try {
    let active = await getActiveCredential(requestId);
    if (!active || active.state !== 'active' || !active.key_hash || !active.encrypted_key) {
      active = undefined;
    } else {
      const updatedTask = await requireTask(account.userId, requestId);
      const providerLimit = await absoluteLimitForActiveCredential(updatedTask, active);
      await updateManagedKey(active.key_hash, { limit: providerLimit });
      const { error: updateError } = await supabaseAdmin!
        .from('blue_runtime_credentials')
        .update({ provider_limit: providerLimit, updated_at: new Date().toISOString() })
        .eq('id', active.id)
        .eq('state', 'active');
      if (updateError) throw updateError;
      active.provider_limit = providerLimit;
    }
    const updatedTask = await requireTask(account.userId, requestId);
    const model = resolveModel(await getOpenRouterModels(), updatedTask.model);
    if (!model) throw new Error('The selected model is no longer available');
    const credential = active ? decryptCredential(active) : await provisionCredential(updatedTask);
    return admissionPayload(updatedTask, credential, Number(data?.remaining || 0), model);
  } catch (error) {
    // A management timeout is ambiguous: OpenRouter may already have raised
    // the absolute key limit. Keep the bounded reservation and let a retry with
    // the same extension ID set the same absolute limit idempotently.
    throw statusError(503, `Blue could not confirm the provider allowance extension yet: ${safeMessage(error)}`);
  }
}

export async function completeBlueRuntimeTask(
  account: BluePaygAccount,
  requestId: string,
  deviceId: string,
  outcome: 'completed' | 'failed' | 'stopped' | 'expired',
  clientUsage: RuntimeClientUsage = {}
): Promise<BlueRuntimeFinalization> {
  const task = await requireTask(account.userId, requestId);
  if (task.device_hash !== sha256(deviceId)) throw statusError(403, 'This Blue runtime belongs to another device');
  return settleRuntimeTask(task, outcome, clientUsage);
}

export async function reconcileBlueRuntimeTasks(options: {
  userId?: string;
  limit?: number;
} = {}): Promise<{ inspected: number; settled: number; pending: number; failed: number }> {
  if (!supabaseAdmin) return { inspected: 0, settled: 0, pending: 0, failed: 0 };
  const limit = Math.max(1, Math.min(250, options.limit || 100));
  let stoppingQuery = supabaseAdmin
    .from('blue_runtime_tasks')
    .select('*')
    .eq('state', 'stopping')
    .order('settlement_next_attempt_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  let expiredQuery = supabaseAdmin
    .from('blue_runtime_tasks')
    .select('*')
    .in('state', ['provisioning', 'active'])
    .lte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(limit);
  if (options.userId) {
    stoppingQuery = stoppingQuery.eq('user_id', options.userId);
    expiredQuery = expiredQuery.eq('user_id', options.userId);
  }
  const [stopping, expired] = await Promise.all([stoppingQuery, expiredQuery]);
  if (stopping.error || expired.error) {
    throw statusError(500, `Could not reconcile Blue runtime tasks: ${stopping.error?.message || expired.error?.message}`);
  }
  const byId = new Map<string, RuntimeTaskRow>();
  const now = Date.now();
  const readyStoppingTasks = (stopping.data || []).filter(task =>
    !task.settlement_next_attempt_at
    || Date.parse(String(task.settlement_next_attempt_at)) <= now
  );
  for (const task of [...readyStoppingTasks, ...(expired.data || [])] as RuntimeTaskRow[]) {
    byId.set(task.request_id, task);
  }
  const candidates = Array.from(byId.values()).slice(0, limit);
  let settled = 0;
  let pending = 0;
  let failed = 0;
  for (const task of candidates) {
    try {
      const persistedOutcome = runtimeOutcome(task.terminal_reason);
      const outcome = task.state === 'stopping'
        ? persistedOutcome || 'failed'
        : 'expired';
      const result = await settleRuntimeTask(task, outcome, {});
      if (result.state === 'stopping') pending += 1;
      else settled += 1;
    } catch {
      failed += 1;
    }
  }
  await cleanupDisabledCredentials(limit).catch(() => 0);
  return { inspected: candidates.length, settled, pending, failed };
}

export async function blockedRuntimeModels(): Promise<Set<string>> {
  if (!supabaseAdmin) return new Set();
  const { data } = await supabaseAdmin.from('blue_runtime_model_blocks').select('model');
  return new Set((data || []).map(row => String(row.model)));
}

async function settleRuntimeTask(
  initialTask: RuntimeTaskRow,
  outcome: 'completed' | 'failed' | 'stopped' | 'expired',
  clientUsage: RuntimeClientUsage
): Promise<BlueRuntimeFinalization> {
  assertConfigured();
  let task = await requireTask(initialTask.user_id, initialTask.request_id);
  if (isTerminal(task.state)) return existingSettlement(task, await walletBalance(task.user_id));

  const now = new Date();
  const requestedAt = task.settlement_requested_at || now.toISOString();
  const effectiveOutcome = task.state === 'stopping'
    ? runtimeOutcome(task.terminal_reason) || outcome
    : outcome;
  const promptTokens = Math.max(Number(task.prompt_tokens || 0), boundedUsage(clientUsage.prompt_tokens));
  const completionTokens = Math.max(Number(task.completion_tokens || 0), boundedUsage(clientUsage.completion_tokens));
  const clientProviderCostHint = Math.max(
    Number(task.client_provider_cost_hint || 0),
    boundedProviderCost(clientUsage.provider_cost)
  );
  const { error: stoppingError } = await supabaseAdmin!.from('blue_runtime_tasks').update({
    state: 'stopping',
    terminal_reason: effectiveOutcome,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    client_provider_cost_hint: clientProviderCostHint,
    settlement_requested_at: requestedAt,
    settlement_next_attempt_at: null,
    settlement_attempts: Number(task.settlement_attempts || 0) + 1,
    updated_at: now.toISOString()
  }).eq('request_id', task.request_id).in('state', ['provisioning', 'active', 'stopping']);
  if (stoppingError) throw statusError(500, `Could not persist Blue settlement state: ${stoppingError.message}`);
  task = {
    ...task,
    state: 'stopping',
    terminal_reason: effectiveOutcome,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    client_provider_cost_hint: clientProviderCostHint,
    settlement_requested_at: requestedAt,
    settlement_attempts: Number(task.settlement_attempts || 0) + 1
  };

  const { data: rows, error } = await supabaseAdmin!
    .from('blue_runtime_credentials')
    .select('*')
    .eq('request_id', task.request_id)
    .order('created_at', { ascending: true });
  if (error) throw statusError(500, `Could not load Blue runtime credentials: ${error.message}`);
  const credentials = (rows || []) as RuntimeCredentialRow[];

  for (const credential of credentials) {
    if (credential.key_hash && ['active', 'provisioning', 'disabled'].includes(credential.state)) {
      await disableAndObserveCredential(credential);
    } else if (!credential.key_hash && credential.state === 'provisioning') {
      await supabaseAdmin!.from('blue_runtime_credentials').update({
        state: 'failed', encrypted_key: null, encryption_iv: null, encryption_tag: null,
        updated_at: new Date().toISOString()
      }).eq('id', credential.id);
    }
  }

  const { data: measuredRows, error: measuredError } = await supabaseAdmin!
    .from('blue_runtime_credentials')
    .select('id, request_id, key_hash, state, provider_usage_start, provider_usage_final, usage_observed_at, usage_stable_observations, provider_limit, created_at, updated_at, expires_at, disabled_at, deleted_at')
    .eq('request_id', task.request_id);
  if (measuredError) throw statusError(500, `Could not verify Blue runtime usage: ${measuredError.message}`);
  const measuredCredentials = (measuredRows || []) as RuntimeCredentialRow[];
  const decision = decideRuntimeSettlement({
    requestedAt: Date.parse(requestedAt),
    now: Date.now(),
    usageGraceMs: USAGE_SETTLEMENT_GRACE_MS,
    zeroUsageGraceMs: ZERO_USAGE_SETTLEMENT_GRACE_MS,
    credentials: measuredCredentials.map(credential => ({
      keyHash: credential.key_hash,
      state: credential.state,
      usageStart: Number(credential.provider_usage_start || 0),
      usageObserved: credential.provider_usage_final === null
        ? null
        : Number(credential.provider_usage_final),
      stableObservations: Number(credential.usage_stable_observations || 0)
    }))
  });

  if (!decision.ready) {
    const nextAttemptAt = new Date(Date.now() + decision.retryAfterSeconds * 1000).toISOString();
    const { error: pendingError } = await supabaseAdmin!.from('blue_runtime_tasks').update({
      settlement_next_attempt_at: nextAttemptAt,
      updated_at: new Date().toISOString()
    }).eq('request_id', task.request_id).eq('state', 'stopping');
    if (pendingError) throw statusError(500, `Could not persist Blue settlement retry: ${pendingError.message}`);
    return {
      request_id: task.request_id,
      state: 'stopping',
      settlement_pending: true,
      reserved_blue_credits: Number(task.reserved_blue_credits),
      remaining_blue_credits: await walletBalance(task.user_id),
      provisional_provider_cost: decision.providerCost,
      retry_after_seconds: decision.retryAfterSeconds
    };
  }

  const providerCost = decision.providerCost;

  if (task.is_free && providerCost > 0) {
    await supabaseAdmin!.from('blue_runtime_model_blocks').upsert({
      model: task.model,
      reason: `OpenRouter reported ${providerCost} USD for a model catalogued as free`,
      created_at: new Date().toISOString()
    });
  }

  const billingAccount = await loadBillingAccount(task.user_id, 0.15, true);
  const settlement = await settleUsage(
    billingAccount,
    task.request_id,
    task.is_free ? 0 : providerCost,
    promptTokens,
    completionTokens
  );
  const terminalState: RuntimeTaskState = effectiveOutcome === 'completed'
    ? 'completed'
    : effectiveOutcome === 'expired' ? 'expired' : 'failed';
  const finishedAt = new Date().toISOString();
  const { error: finalError } = await supabaseAdmin!.from('blue_runtime_tasks').update({
    state: terminalState,
    provider_cost: providerCost,
    charged_blue_credits: settlement.charged,
    balance_after: settlement.remaining,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    terminal_reason: effectiveOutcome,
    settlement_next_attempt_at: null,
    updated_at: finishedAt,
    finished_at: finishedAt
  }).eq('request_id', task.request_id).eq('user_id', task.user_id);
  if (finalError) throw statusError(500, `Could not finalize Blue runtime task: ${finalError.message}`);
  await Promise.all(measuredCredentials.map(credential => deleteSettledCredential(credential)));
  task = { ...task, state: terminalState, provider_cost: providerCost, prompt_tokens: promptTokens, completion_tokens: completionTokens };
  return {
    request_id: task.request_id,
    state: terminalState,
    reserved_blue_credits: Number(task.reserved_blue_credits),
    charged_blue_credits: settlement.charged,
    refunded_blue_credits: Math.max(0, roundCredits(Number(task.reserved_blue_credits) - settlement.charged)),
    provider_cost: providerCost,
    remaining_blue_credits: settlement.remaining,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens
  };
}

async function disableAndObserveCredential(credential: RuntimeCredentialRow): Promise<void> {
  if (!credential.key_hash) return;
  let usage = Math.max(
    Number(credential.provider_usage_start || 0),
    Number(credential.provider_usage_final ?? credential.provider_usage_start ?? 0)
  );
  try {
    const current = credential.state === 'disabled'
      ? await getManagedKey(credential.key_hash)
      : await updateManagedKey(credential.key_hash, { disabled: true });
    usage = Math.max(usage, Number(current.usage || 0));
  } catch (error) {
    throw statusError(502, `Blue could not verify provider usage yet: ${safeMessage(error)}`);
  }

  const observedAt = Date.now();
  const observation = nextStableUsageObservation({
    previousUsage: credential.provider_usage_final === null
      ? null
      : Number(credential.provider_usage_final),
    previousStableObservations: Number(credential.usage_stable_observations || 0),
    previousObservedAt: credential.usage_observed_at
      ? Date.parse(credential.usage_observed_at)
      : null,
    observedUsage: usage,
    now: observedAt,
    minimumIntervalMs: USAGE_OBSERVATION_INTERVAL_MS
  });
  const observedAtIso = new Date(observedAt).toISOString();
  const { error } = await supabaseAdmin!.from('blue_runtime_credentials').update({
    state: 'disabled',
    provider_usage_final: observation.usage,
    usage_observed_at: observedAtIso,
    usage_stable_observations: observation.stableObservations,
    encrypted_key: null,
    encryption_iv: null,
    encryption_tag: null,
    encryption_version: null,
    disabled_at: credential.disabled_at || observedAtIso,
    updated_at: observedAtIso
  }).eq('id', credential.id);
  if (error) throw statusError(500, `Could not persist provider revocation: ${error.message}`);
}

async function deleteSettledCredential(credential: RuntimeCredentialRow): Promise<void> {
  if (!credential.key_hash || credential.state === 'deleted') return;
  try {
    await deleteManagedKey(credential.key_hash);
    await supabaseAdmin!.from('blue_runtime_credentials').update({
      state: 'deleted', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', credential.id);
  } catch {
    // The key is already disabled and unusable. A later cleanup may retry deletion.
  }
}

async function cleanupDisabledCredentials(limit: number): Promise<number> {
  const { data: credentials, error } = await supabaseAdmin!
    .from('blue_runtime_credentials')
    .select('*')
    .eq('state', 'disabled')
    .order('updated_at', { ascending: true })
    .limit(Math.max(1, Math.min(250, limit)));
  if (error || !credentials?.length) return 0;
  const requestIds = Array.from(new Set(credentials.map(row => String(row.request_id))));
  const { data: tasks, error: taskError } = await supabaseAdmin!
    .from('blue_runtime_tasks')
    .select('request_id, state')
    .in('request_id', requestIds);
  if (taskError) return 0;
  const terminal = new Set((tasks || [])
    .filter(task => isTerminal(task.state as RuntimeTaskState))
    .map(task => String(task.request_id)));
  let deleted = 0;
  for (const credential of credentials as RuntimeCredentialRow[]) {
    if (!terminal.has(credential.request_id)) continue;
    await deleteSettledCredential(credential);
    deleted += 1;
  }
  return deleted;
}

async function activeOrProvision(task: RuntimeTaskRow): Promise<BlueRuntimeCredential | undefined> {
  const active = await getActiveCredential(task.request_id);
  if (active?.state === 'active' && active.encrypted_key) return decryptCredential(active);
  if (active?.state === 'provisioning') return undefined;
  return provisionCredential(task);
}

async function provisionCredential(task: RuntimeTaskRow): Promise<BlueRuntimeCredential | undefined> {
  const remainingProviderAllowance = await remainingProviderAllowanceForTask(task);
  if (!task.is_free && remainingProviderAllowance <= 0) {
    throw statusError(402, 'This Blue task has reached its reserved provider allowance');
  }
  const expiresAt = credentialExpiry();
  const providerLimit = task.is_free
    ? Math.max(0.000001, remainingProviderAllowance)
    : roundProvider(remainingProviderAllowance);
  const { data: inserted, error: insertError } = await supabaseAdmin!
    .from('blue_runtime_credentials')
    .insert({
      request_id: task.request_id,
      provider_limit: providerLimit,
      expires_at: expiresAt,
      state: 'provisioning'
    })
    .select('*')
    .single();
  if (insertError) {
    if (/duplicate|unique/i.test(insertError.message || '')) return undefined;
    throw statusError(500, `Could not provision Blue runtime metadata: ${insertError.message}`);
  }
  const placeholder = inserted as RuntimeCredentialRow;
  let keyHash = '';
  try {
    const providerModel = resolveModel(await getOpenRouterModels(), task.model);
    if (!providerModel) throw new Error('The selected Blue model is no longer available');
    const guardrailId = await ensureModelGuardrail(providerModel.id);
    const created = await createManagedKey({
      name: `Blue ${task.request_id}`.slice(0, 200),
      limit: providerLimit,
      expiresAt
    });
    keyHash = created.data.hash;
    if (!keyHash || !created.key) throw new Error('OpenRouter did not return a complete child credential');
    await supabaseAdmin!.from('blue_runtime_credentials').update({
      key_hash: keyHash,
      guardrail_id: guardrailId,
      provider_usage_start: Math.max(0, Number(created.data.usage || 0)),
      updated_at: new Date().toISOString()
    }).eq('id', placeholder.id);
    await assignKeyGuardrail(guardrailId, keyHash);

    const encrypted = encryptRuntimeSecret(created.key, credentialAad(task.request_id, placeholder.id));
    const now = new Date().toISOString();
    const { error: activateError } = await supabaseAdmin!.from('blue_runtime_credentials').update({
      encrypted_key: encrypted.encryptedKey,
      encryption_iv: encrypted.iv,
      encryption_tag: encrypted.tag,
      encryption_version: encrypted.version,
      state: 'active',
      updated_at: now
    }).eq('id', placeholder.id).eq('state', 'provisioning');
    if (activateError) throw activateError;
    const { error: taskError } = await supabaseAdmin!.from('blue_runtime_tasks').update({
      state: 'active', expires_at: expiresAt, updated_at: now
    }).eq('request_id', task.request_id).in('state', ['provisioning', 'active']);
    if (taskError) throw taskError;
    await supabaseAdmin!.from('billing_reservations').update({
      expires_at: new Date(Date.parse(expiresAt) + 10 * 60 * 1000).toISOString()
    }).eq('request_id', task.request_id).eq('status', 'pending');
    return {
      token: created.key,
      expires_at: expiresAt,
      base_url: OPENROUTER_BASE_URL,
      model: providerModel.id
    };
  } catch (error) {
    if (keyHash) {
      try { await updateManagedKey(keyHash, { disabled: true }); } catch {}
      try { await deleteManagedKey(keyHash); } catch {}
    }
    await supabaseAdmin!.from('blue_runtime_credentials').update({
      state: 'failed', encrypted_key: null, encryption_iv: null, encryption_tag: null,
      encryption_version: null, updated_at: new Date().toISOString()
    }).eq('id', placeholder.id);
    await failUnprovisionedTask(task, safeMessage(error));
    throw statusError(502, `Blue could not provision a provider credential: ${safeMessage(error)}`);
  }
}

async function ensureModelGuardrail(model: string): Promise<string> {
  const { data: existing } = await supabaseAdmin!
    .from('blue_model_guardrails')
    .select('guardrail_id')
    .eq('model', model)
    .maybeSingle();
  if (existing?.guardrail_id) return String(existing.guardrail_id);

  const createdId = await createModelGuardrail(model);
  const { error } = await supabaseAdmin!.from('blue_model_guardrails').insert({
    model,
    guardrail_id: createdId
  });
  if (!error) return createdId;
  if (!/duplicate|unique/i.test(error.message || '')) {
    try { await deleteGuardrail(createdId); } catch {}
    throw error;
  }
  const { data: winner, error: winnerError } = await supabaseAdmin!
    .from('blue_model_guardrails')
    .select('guardrail_id')
    .eq('model', model)
    .single();
  try { await deleteGuardrail(createdId); } catch {}
  if (winnerError || !winner?.guardrail_id) throw winnerError || new Error('Model guardrail race was not resolved');
  return String(winner.guardrail_id);
}

async function remainingProviderAllowanceForTask(task: RuntimeTaskRow): Promise<number> {
  const { data } = await supabaseAdmin!
    .from('blue_runtime_credentials')
    .select('provider_usage_start, provider_usage_final')
    .eq('request_id', task.request_id);
  const consumed = (data || []).reduce((sum, row) => {
    const start = Math.max(0, Number(row.provider_usage_start || 0));
    const end = Math.max(start, Number(row.provider_usage_final ?? start));
    return sum + end - start;
  }, 0);
  const ceiling = task.is_free ? FREE_PROVIDER_CEILING : Number(task.reserved_blue_credits) / BLUE_CREDIT_MULTIPLIER;
  return roundProvider(Math.max(0, ceiling - consumed));
}

async function absoluteLimitForActiveCredential(
  task: RuntimeTaskRow,
  active: RuntimeCredentialRow
): Promise<number> {
  const { data, error } = await supabaseAdmin!
    .from('blue_runtime_credentials')
    .select('id, provider_usage_start, provider_usage_final')
    .eq('request_id', task.request_id);
  if (error) throw error;
  const previousUsage = (data || []).reduce((sum, row) => {
    if (String(row.id) === active.id) return sum;
    const start = Math.max(0, Number(row.provider_usage_start || 0));
    const end = Math.max(start, Number(row.provider_usage_final ?? start));
    return sum + end - start;
  }, 0);
  const taskCeiling = Number(task.reserved_blue_credits) / BLUE_CREDIT_MULTIPLIER;
  return roundProvider(
    Math.max(0, Number(active.provider_usage_start || 0) + taskCeiling - previousUsage)
  );
}

async function extendRuntimeExpiry(requestId: string): Promise<void> {
  const expiresAt = credentialExpiry();
  await Promise.all([
    supabaseAdmin!.from('blue_runtime_tasks').update({
      expires_at: expiresAt, updated_at: new Date().toISOString()
    }).eq('request_id', requestId).in('state', ['provisioning', 'active']),
    supabaseAdmin!.from('billing_reservations').update({
      expires_at: new Date(Date.parse(expiresAt) + 10 * 60 * 1000).toISOString()
    }).eq('request_id', requestId).eq('status', 'pending')
  ]);
}

async function failUnprovisionedTask(task: RuntimeTaskRow, reason: string): Promise<void> {
  const account = await loadBillingAccount(task.user_id, 0.15, true);
  await releaseUsage(account, task.request_id);
  await supabaseAdmin!.from('blue_runtime_tasks').update({
    state: 'failed', terminal_reason: reason.slice(0, 500),
    updated_at: new Date().toISOString(), finished_at: new Date().toISOString()
  }).eq('request_id', task.request_id).eq('state', 'provisioning');
}

async function getTaskForUser(userId: string, requestId: string): Promise<RuntimeTaskRow | undefined> {
  const { data, error } = await supabaseAdmin!
    .from('blue_runtime_tasks')
    .select('*')
    .eq('request_id', requestId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw statusError(500, `Could not load Blue runtime task: ${error.message}`);
  return data as RuntimeTaskRow | undefined;
}

async function requireTask(userId: string, requestId: string): Promise<RuntimeTaskRow> {
  const task = await getTaskForUser(userId, requestId);
  if (!task) throw statusError(404, 'Blue runtime task not found');
  return task;
}

async function getActiveCredential(requestId: string): Promise<RuntimeCredentialRow | undefined> {
  const { data, error } = await supabaseAdmin!
    .from('blue_runtime_credentials')
    .select('*')
    .eq('request_id', requestId)
    .in('state', ['provisioning', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw statusError(500, `Could not load Blue runtime credential: ${error.message}`);
  return data as RuntimeCredentialRow | undefined;
}

function decryptCredential(row: RuntimeCredentialRow): BlueRuntimeCredential {
  if (!row.encrypted_key || !row.encryption_iv || !row.encryption_tag || row.encryption_version !== 'v1') {
    throw statusError(503, 'Blue runtime credential is still provisioning');
  }
  return {
    token: decryptRuntimeSecret({
      encryptedKey: row.encrypted_key,
      iv: row.encryption_iv,
      tag: row.encryption_tag,
      version: row.encryption_version
    }, credentialAad(row.request_id, row.id)),
    expires_at: row.expires_at,
    base_url: OPENROUTER_BASE_URL,
    model: ''
  };
}

function admissionPayload(
  task: RuntimeTaskRow,
  credential: BlueRuntimeCredential | undefined,
  remaining: number,
  model: ReturnType<typeof resolveModel> extends infer _T ? NonNullable<Awaited<ReturnType<typeof getOpenRouterModels>>[number]> : never
): BlueRuntimeAdmission {
  if (credential) credential.model = model.id;
  return {
    request_id: task.request_id,
    state: credential ? 'active' : task.state,
    credential,
    billing: {
      reserved_blue_credits: Number(task.reserved_blue_credits),
      remaining_blue_credits: Math.max(0, Number(remaining || 0)),
      provider_limit: task.is_free ? FREE_PROVIDER_CEILING : Number(task.reserved_blue_credits) / BLUE_CREDIT_MULTIPLIER,
      extension_blue_credits: BLUE_RUNTIME_EXTENSION_ALLOWANCE,
      multiplier: BLUE_CREDIT_MULTIPLIER,
      free_model: task.is_free
    },
    rate_card: {
      prompt: price(model.pricing?.prompt),
      completion: price(model.pricing?.completion),
      request: price(model.pricing?.request),
      cache_read: price(model.pricing?.input_cache_read),
      cache_write: price(model.pricing?.input_cache_write),
      reasoning: price(model.pricing?.internal_reasoning)
    }
  };
}

function existingSettlement(task: RuntimeTaskRow, remaining: number): BlueRuntimeSettlement {
  const charged = Math.max(0, Number(task.charged_blue_credits || 0));
  return {
    request_id: task.request_id,
    state: task.state === 'completed' || task.state === 'expired' ? task.state : 'failed',
    reserved_blue_credits: Number(task.reserved_blue_credits),
    charged_blue_credits: charged,
    refunded_blue_credits: Math.max(0, roundCredits(Number(task.reserved_blue_credits) - charged)),
    provider_cost: Number(task.provider_cost),
    remaining_blue_credits: Math.max(0, Number(task.balance_after ?? remaining)),
    prompt_tokens: Number(task.prompt_tokens),
    completion_tokens: Number(task.completion_tokens)
  };
}

async function loadBillingAccount(userId: string, fallbackThreshold: number, allowInactive = false): Promise<BluePaygAccount> {
  const [{ data: wallet, error: walletError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin!.from('wallets').select('account_type, blue_credits').eq('user_id', userId).maybeSingle(),
    supabaseAdmin!.from('blue_profiles').select('access_tier, last_top_up_credits, status').eq('user_id', userId).maybeSingle()
  ]);
  if (walletError || profileError || !wallet || !profile) throw statusError(500, 'Could not load Blue billing state');
  if (!allowInactive && profile.status !== 'active') throw statusError(403, 'This Blue account is not active');
  return {
    userId,
    balance: Math.max(0, Number(wallet.blue_credits || 0)),
    accessTier: profile.access_tier === 'full' ? 'full' : 'trial',
    lastTopUpCredits: Math.max(0, Number(profile.last_top_up_credits || 0)),
    threshold: Math.max(0, fallbackThreshold)
  };
}

async function walletBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin!.from('wallets').select('blue_credits').eq('user_id', userId).maybeSingle();
  return Math.max(0, Number(data?.blue_credits || 0));
}

async function isRuntimeModelBlocked(model: string): Promise<boolean> {
  const { data } = await supabaseAdmin!.from('blue_runtime_model_blocks').select('model').eq('model', model).maybeSingle();
  return Boolean(data?.model);
}

function validateAdmissionInput(input: BlueRuntimeAdmissionInput): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(input.requestId)) throw statusError(400, 'Invalid Blue runtime task ID');
  if (!input.model || input.model.length > 200) throw statusError(400, 'An exact Blue model is required');
  if (input.mode !== 'normal' && input.mode !== 'ui_max') throw statusError(400, 'Invalid Blue runtime mode');
  if (!input.clientVersion || input.clientVersion.length > 64) throw statusError(400, 'A valid Blue client version is required');
  if (!input.deviceId || input.deviceId.length < 16 || input.deviceId.length > 256) throw statusError(400, 'A valid Blue device binding is required');
}

function assertConfigured(): void {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');
  if (!process.env.OPENROUTER_MANAGEMENT_API_KEY) throw statusError(500, 'Blue model runtime is not configured');
  if (!process.env.OPENROUTER_WORKSPACE_ID) throw statusError(500, 'Blue model workspace is not configured');
  if (!process.env.BLUE_RUNTIME_TOKEN_ENCRYPTION_KEY) throw statusError(500, 'Blue runtime token encryption is not configured');
}

export function publicBlueRuntimeError(error: unknown, fallback = 'Blue runtime request failed'): string {
  const message = error instanceof Error ? error.message : fallback;
  return String(message || fallback)
    .replace(/https?:\/\/openrouter\.ai\/[^\s"'<>)]*/gi, 'Blue model service')
    .replace(/\bOpenRouter\b/gi, 'Blue')
    .replace(/\bopenrouter\b/gi, 'blue')
    .slice(0, 500);
}

function mapDatabaseError(message: string): Error & { status: number } {
  if (/insufficient/i.test(message)) return statusError(402, 'Your Blue Credits are too low for this task');
  if (/concurrency/i.test(message)) return statusError(429, 'Your Blue account already has the maximum number of active tasks');
  if (/belongs to another|conflict|does not match/i.test(message)) return statusError(409, message);
  return statusError(500, `Blue runtime admission failed: ${message}`);
}

function isTerminal(state: RuntimeTaskState): boolean {
  return state === 'completed' || state === 'failed' || state === 'expired';
}

function credentialExpiry(): string {
  return new Date(Date.now() + BLUE_RUNTIME_CREDENTIAL_MINUTES * 60 * 1000).toISOString();
}

function credentialAad(requestId: string, credentialId: string): string {
  return `blue-runtime:${requestId}:${credentialId}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableJson(value: Record<string, unknown>): string {
  return JSON.stringify(Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = value[key];
    return result;
  }, {}));
}

function finitePositive(value: unknown): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function boundedUsage(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(parsed))) : 0;
}

function boundedProviderCost(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? roundProvider(Math.max(0, parsed)) : 0;
}

function positiveDuration(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function runtimeOutcome(value: unknown): 'completed' | 'failed' | 'stopped' | 'expired' | undefined {
  const outcome = String(value || '');
  return outcome === 'completed' || outcome === 'failed' || outcome === 'stopped' || outcome === 'expired'
    ? outcome
    : undefined;
}

function roundCredits(value: number): number {
  return Number(Math.max(0, value).toFixed(10));
}

function roundProvider(value: number): number {
  return Number(Math.max(0, value).toFixed(12));
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'Unknown provider management error';
}
