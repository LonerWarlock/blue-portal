import { issueTaskTicket } from './blueTaskTicket.mjs';
import { releaseProxyHold } from './blueProxyRedis.mjs';
import { supabaseAdmin } from './supabaseAdmin';
import { selectProxyBase } from './blueProxyEndpoints.mjs';

export function assertProxyConfigured(): void {
  if (!process.env.OPENROUTER_API_KEY || (process.env.BLUE_TASK_TICKET_SECRET || '').length < 32) {
    throw Object.assign(new Error('Blue task proxy is not configured.'), { status: 503 });
  }
}

export async function mintBlueTaskCredential(task: { user_id: string; request_id: string; device_hash: string; runtime_transport?: string }, models: string[]) {
  assertProxyConfigured();
  if (task.runtime_transport !== 'ticket') throw Object.assign(new Error('This saved task uses the retired connection protocol. Finish it and start a new task.'), { status: 426 });
  const baseUrl = await selectProxyBase(process.env);
  const { error } = await supabaseAdmin!.rpc('activate_blue_proxy_task', {
    user_id_param: task.user_id, request_id_param: task.request_id, models_param: models
  });
  if (error) throw Object.assign(new Error('Blue could not authorize this saved task.'), { status: 409 });
  const ticket = await issueTaskTicket({ userId: task.user_id, taskId: task.request_id, deviceHash: task.device_hash, models, baseUrl }, process.env.BLUE_TASK_TICKET_SECRET);
  return { ...ticket, kind: 'blue-task-ticket' as const, base_url: baseUrl, model: models[0],
    ...(models[1] ? { approval_reviewer_model: models[1] } : {}) };
}

export async function finishProxyTask(task: { user_id: string; request_id: string }, outcome: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin!.rpc('finish_blue_proxy_task', {
    user_id_param: task.user_id, request_id_param: task.request_id, outcome_param: outcome
  });
  if (error) throw Object.assign(new Error('Blue could not settle this task yet. Its credit hold is preserved.'), { status: 503 });
  return data?.pending === true;
}

type ReconciliationScope = { userId: string; requestId: string };
type PendingCall = { id: string; state: string; provider_generation_id: string | null; updated_at: string };
const UNVERIFIED_HOLD_TIMEOUT_MS = 24 * 60 * 60 * 1000;

async function reconcileCall(call: PendingCall): Promise<void> {
  if (call.state === 'reserved') {
    await supabaseAdmin!.rpc('settle_blue_proxy_call', { call_id_param: call.id,
      cost_param: 0, prompt_tokens_param: 0, completion_tokens_param: 0, release_param: true });
    return;
  }
  if (call.provider_generation_id) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/generation?id=' + encodeURIComponent(call.provider_generation_id), {
        headers: { Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const value = (await response.json()).data;
        if (value?.id === call.provider_generation_id && (value.finish_reason || value.cancelled === true)
          && typeof value.total_cost === 'number' && Number.isFinite(value.total_cost) && value.total_cost >= 0) {
          await supabaseAdmin!.rpc('settle_blue_proxy_call', { call_id_param: call.id,
            cost_param: value.total_cost, prompt_tokens_param: value.tokens_prompt || 0,
            completion_tokens_param: value.tokens_completion || 0, release_param: false });
          return;
        }
      }
    } catch { /* The next attempt can still obtain exact usage. */ }
  }
  if (Date.parse(call.updated_at) <= Date.now() - UNVERIFIED_HOLD_TIMEOUT_MS) {
    await supabaseAdmin!.rpc('expire_blue_unverified_proxy_call', { call_id_param: call.id });
  }
}

/** Reconcile only server-observed generation IDs. Client usage is never billing evidence. */
export async function reconcileProxyCalls(limit = 100, scope?: ReconciliationScope): Promise<number> {
  const { data, error } = await supabaseAdmin!.rpc('claim_blue_proxy_reconciliation', {
    limit_param: limit, request_id_param: scope?.requestId ?? null, user_id_param: scope?.userId ?? null
  });
  if (error) throw Object.assign(new Error('Blue could not read pending model calls.'), { status: 503 });
  const calls = (data || []) as PendingCall[];
  // Bounded parallel lookups fit within the cron deadline even if a provider is slow.
  for (let offset = 0; offset < calls.length; offset += 8) {
    await Promise.allSettled(calls.slice(offset, offset + 8).map(reconcileCall));
  }
  if (scope) return calls.length;
  // Acknowledge each successful cleanup once. Do not sweep/rewrite all historical
  // holds every minute: the index includes only unacknowledged settled calls.
  const { data: cleanup, error: cleanupError } = await supabaseAdmin!.from('blue_proxy_calls')
    .select('id,request_id,user_id').in('state', ['settled','released']).eq('redis_hold_required', true)
    .is('redis_released_at', null).limit(limit);
  if (cleanupError) throw Object.assign(new Error('Blue could not read settled credit cleanup.'), { status: 503 });
  for (const call of cleanup || []) {
    try {
      await releaseProxyHold(process.env, call.request_id, call.id, call.user_id);
      await supabaseAdmin!.rpc('confirm_blue_proxy_redis_release', { call_id_param: call.id });
    } catch { /* An interrupted cleanup is idempotent and remains in the outbox. */ }
  }
  return calls.length;
}
