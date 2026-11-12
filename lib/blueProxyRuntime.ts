import { issueTaskTicket } from './blueTaskTicket.mjs';
import { releaseProxyHold } from './blueProxyRedis.mjs';
import { supabaseAdmin } from './supabaseAdmin';
import { configuredProxyBase, selectProxyBase } from './blueProxyEndpoints.mjs';

export function assertProxyConfigured(): void {
  configuredProxyBase(process.env);
  if (!process.env.OPENROUTER_API_KEY || (process.env.BLUE_TASK_TICKET_SECRET || '').length < 32
    || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw Object.assign(new Error('Blue task proxy is not configured.'), { status: 503 });
  }
}

export async function mintBlueTaskCredential(task: { user_id: string; request_id: string; device_hash: string; runtime_transport?: string }, models: string[]) {
  assertProxyConfigured();
  if (task.runtime_transport !== 'ticket') throw Object.assign(new Error('This saved task uses the retired connection protocol. Finish it and start a new task.'), { status: 426 });
  const { error } = await supabaseAdmin!.rpc('activate_blue_proxy_task', {
    user_id_param: task.user_id, request_id_param: task.request_id, models_param: models
  });
  if (error) throw Object.assign(new Error('Blue could not authorize this saved task.'), { status: 409 });
  const baseUrl = await selectProxyBase(process.env);
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

/** Reconcile only server-observed generation IDs. Client usage is never billing evidence. */
export async function reconcileProxyCalls(limit = 100): Promise<void> {
  const staleBefore = new Date(Date.now() - 330000).toISOString();
  const { data: calls, error } = await supabaseAdmin!.from('blue_proxy_calls').select('*')
    .in('state', ['reserved','dispatching','pending']).lt('updated_at', staleBefore).limit(limit);
  if (error) throw Object.assign(new Error('Blue could not read pending model calls.'), { status: 503 });
  for (const call of calls || []) {
    try {
      if (call.state === 'reserved') {
        const { error } = await supabaseAdmin!.rpc('settle_blue_proxy_call', { call_id_param: call.id,
          cost_param: 0, prompt_tokens_param: 0, completion_tokens_param: 0, release_param: true });
        if (error) continue;
      } else if (call.provider_generation_id) {
        const response = await fetch('https://openrouter.ai/api/v1/generation?id=' + encodeURIComponent(call.provider_generation_id), {
          headers: { Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) continue;
        const value = (await response.json()).data;
        if (value?.id !== call.provider_generation_id || !(value.finish_reason || value.cancelled === true) || typeof value.total_cost !== 'number'
          || !Number.isFinite(value.total_cost) || value.total_cost < 0) continue;
        const { error } = await supabaseAdmin!.rpc('settle_blue_proxy_call', { call_id_param: call.id,
          cost_param: value.total_cost, prompt_tokens_param: value.tokens_prompt || 0,
          completion_tokens_param: value.tokens_completion || 0, release_param: false });
        if (error) continue;
      } else {
        // No automatic zero-cost refund for an ambiguous dispatched request.
        // This metadata is visible to operators; no prompt or output is stored.
        continue;
      }
    } catch { /* A later cron invocation safely retries the same call. */ }
  }
  // Acknowledge each successful cleanup once. Do not sweep/rewrite all historical
  // holds every minute: the index includes only unacknowledged settled calls.
  const { data: cleanup, error: cleanupError } = await supabaseAdmin!.from('blue_proxy_calls')
    .select('id,request_id,user_id').in('state', ['settled','released']).is('redis_released_at', null).limit(limit);
  if (cleanupError) throw Object.assign(new Error('Blue could not read settled credit cleanup.'), { status: 503 });
  for (const call of cleanup || []) {
    try {
      await releaseProxyHold(process.env, call.request_id, call.id, call.user_id);
      await supabaseAdmin!.rpc('confirm_blue_proxy_redis_release', { call_id_param: call.id });
    } catch { /* An interrupted cleanup is idempotent and remains in the outbox. */ }
  }
}
