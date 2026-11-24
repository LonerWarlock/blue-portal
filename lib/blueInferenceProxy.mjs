import { verifyTaskTicket, proxyBaseUrl, sha256 } from './blueTaskTicket.mjs';
import { holdProxyCredits, releaseProxyHold } from './blueProxyRedis.mjs';

const ORIGIN = 'https://openrouter.ai/api/v1';
const MAX_REQUEST = 8 * 1024 * 1024;
const MAX_JSON_RESPONSE = 32 * 1024 * 1024;
const MAX_STREAM_HEADERS_WAIT_MS = 35_000;
const ROUTES = new Set(['/chat/completions', '/responses', '/responses/compact', '/images']);
const headers = { 'Cache-Control': 'no-store, no-transform', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no' };
const fail = (status, message, code = 'blue_proxy_error') => Object.assign(new Error(message), { status, code });
const errorResponse = error => Response.json({ error: { message: error.message || 'Blue could not complete the model request.',
  code: error.code || 'blue_proxy_error', type: 'invalid_request_error' } }, { status: error.status || 503, headers });
const catalogueCache = new Map();

// Responses streams must carry protocol-native terminal errors. A chat-only
// {error:{...}} envelope is ignored by Responses clients and becomes a false
// "stream closed before response.completed" failure. Never forward raw provider
// bodies: they may echo prompts, files, authorization metadata or account details.
const providerFailures = {
  context_length_exceeded: ['invalid_prompt', 'provider_context_length', 'The input exceeds the selected model’s context window.'],
  invalid_request: ['invalid_prompt', 'provider_request_validation', 'The provider rejected an option or tool definition in this request.'],
  invalid_prompt: ['invalid_prompt', 'provider_prompt_validation', 'The provider rejected the message format in this request.'],
  not_found: ['server_error', 'provider_resource_missing', 'The provider could not find a requested model or resource.'],
  payload_too_large: ['invalid_prompt', 'provider_request_validation', 'The provider rejected this request because its payload is too large.'],
  unprocessable: ['invalid_prompt', 'provider_request_validation', 'The provider could not process this request format.'],
  precondition_failed: ['invalid_prompt', 'provider_request_precondition', 'A provider request precondition failed.'],
  authentication: ['server_error', 'provider_authentication', 'The model provider reported a model credential authentication failure.'],
  permission_denied: ['server_error', 'provider_forbidden', 'The model provider rejected this request without a recognized reason.'],
  payment_required: ['server_error', 'provider_payment_required', 'The model service reported insufficient provider balance.'],
  content_policy_violation: ['image_content_policy_violation', 'provider_policy', 'The model provider blocked this request under its content or safety policy.'],
  refusal: ['invalid_prompt', 'provider_policy', 'The model provider blocked this request under its content or safety policy.'],
  rate_limit_exceeded: ['rate_limit_exceeded', 'provider_rate_limit', 'The selected model is rate limited. Retry later.'],
  provider_overloaded: ['server_error', 'provider_overloaded', 'The selected model provider is temporarily overloaded.'],
  provider_unavailable: ['server_error', 'provider_unavailable', 'The selected model provider could not return a response.'],
  timeout: ['server_error', 'provider_timeout', 'The model provider timed out before completing its response.'],
  server: ['server_error', 'provider_server_error', 'The model provider could not complete this request.'],
  stream_disconnected: ['server_error', 'BLUE_UPSTREAM_STREAM_CLOSED', 'The upstream model stream ended before completion. Task progress is saved.']
};
const statusFailure = {400:'invalid_request',401:'authentication',402:'payment_required',403:'permission_denied',404:'not_found',408:'timeout',413:'payload_too_large',422:'unprocessable',429:'rate_limit_exceeded',500:'server',502:'provider_unavailable',503:'provider_overloaded',504:'timeout'};

function modelStreamFailure(route, status, category, metadata) {
  const failure = providerFailures[Object.hasOwn(providerFailures, category) ? category : statusFailure[status]]
    || ['server_error', 'provider_rejection', 'The provider declined this model request.'];
  const message = `[${failure[1]}] ${failure[2]} (HTTP ${status}). Your task is saved.`;
  if (route === '/responses') return 'event: response.failed\ndata: ' + JSON.stringify({type:'response.failed',sequence_number:0,response:{id:'blue_proxy_rejection',object:'response',created_at:Math.floor(Date.now()/1000),status:'failed',output:[],error:{code:failure[0],message}}}) + '\n\n';
  return 'data: ' + JSON.stringify({error:{code:status,message,...(metadata ? { metadata } : {})}}) + '\n\n';
}

async function readProviderRejection(response, signal) {
  try {
    const bytes = await readBounded(response.body, 64 * 1024, AbortSignal.any([signal, AbortSignal.timeout(5000)]));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return undefined; }
}

function providerRateLimitMetadata(upstream, rejection) {
  const quota = new Headers();
  const metadata = rejection?.error?.metadata;
  const nested = metadata?.headers;
  const get = name => upstream.headers.get(name) ?? (nested && typeof nested === 'object'
    ? Object.entries(nested).find(([key]) => key.toLowerCase() === name)?.[1] : undefined);
  const retryAfter = get('retry-after');
  if (typeof retryAfter === 'string' && (/^\d{1,8}$/.test(retryAfter)
      || /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(retryAfter)
        && Number.isFinite(Date.parse(retryAfter)))) quota.set('Retry-After', retryAfter);
  for (const name of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
    const value = get(name);
    if ((typeof value === 'number' || typeof value === 'string') && /^\d{1,16}$/.test(String(value))) quota.set(name, String(value));
  }
  // Only forward recognized classifications and bounded timing/count fields.
  const dailyFree = [get('x-ratelimit-source'), get('x-ratelimit-limit-source'), metadata?.limit_source,
    rejection?.error?.message].some(value => typeof value === 'string' && /\bfree-models-per-day\b/i.test(value.slice(0, 1024)));
  return { headers: Object.fromEntries(quota.entries()), ...(dailyFree ? { limit_source: 'free-models-per-day' } : {}) };
}


export async function proxyRpc(env, name, args, fetcher = fetch) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) throw fail(503, 'Blue credit storage is not configured.');
  const response = await fetcher(`${String(url).replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(8000), redirect: 'manual', cache: 'no-store'
  });
  if (!response.ok) {
    // Database errors never include request content or secrets in the response.
    let message = '';
    let detail;
    try { detail = await response.json(); message = String(detail.message || ''); } catch {}
    // This is the only fallback condition: the RPC is certainly absent, so no
    // reservation could have committed. Timeouts/5xx must never replay admission.
    if (name === 'admit_blue_proxy_call_v2' && response.status === 404 && detail?.code === 'PGRST202'
      && message.includes('admit_blue_proxy_call_v2')) throw fail(503, 'Atomic admission migration is not installed.', 'blue_admission_not_installed');
    if (/model request rate limit/i.test(message)) throw fail(429, 'Blue’s model request limit was reached. Retry shortly.');
    if (/call identity conflict/i.test(message)) throw fail(409, 'This model call ID was already used for another request.');
    if (/Organization member credit cap/i.test(message)) throw fail(402,'Your Organization spending cap has been reached.','blue_member_budget');
    if (/allowance exhausted/i.test(message)) throw fail(402, 'This task reached its model allowance.', 'blue_task_budget');
    if (/access denied|not active/i.test(message)) throw fail(403, 'This Blue task is no longer authorized.');
    if (/too many active/i.test(message)) throw fail(429, 'This task already has too many active model requests.');
    throw fail(503, 'Blue could not confirm the model request in its credit ledger.');
  }
  return response.json();
}

async function readBounded(stream, limit, signal) {
  if (!stream) throw fail(400, 'A JSON model request is required.');
  const reader = stream.getReader();
  const chunks = []; let size = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, {once:true});
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) throw fail(413, 'The model request or response exceeds Blue’s size limit.');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { signal?.removeEventListener('abort', cancel); }
  signal?.throwIfAborted();
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function modelInfo(env, model, fetcher, route) {
  const cacheKey = await sha256(env.OPENROUTER_API_KEY || '');
  const cached = catalogueCache.get(cacheKey);
  let rows = cached?.until > Date.now() ? cached.rows : undefined;
  if (!rows) {
    const pages = await Promise.all(['','?output_modalities=image'].map(async query => {
      const response = await fetcher(ORIGIN + '/models/user' + query, { headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY },
        redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw fail(503, 'Blue could not verify current model pricing.');
      const payload = await response.json();
      if (!Array.isArray(payload.data)) throw fail(503, 'Blue could not verify current model pricing.');
      return payload.data;
    }));
    rows = [...new Map(pages.flat().map(row => [row.id, row])).values()];
    catalogueCache.clear(); catalogueCache.set(cacheKey, { until: Date.now() + 60000, rows });
  }
  const row = rows.find(row => row.id === model);
  if (!row) throw fail(400, 'The selected model is currently unavailable.');
  if (route === '/images') {
    const response = await fetcher(ORIGIN + '/images/models/' + model.split('/').map(encodeURIComponent).join('/') + '/endpoints', {
      redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw fail(503, 'Blue could not verify this image model’s pricing.');
    const payload = await response.json();
    return { ...row, imageEndpoints: payload.endpoints };
  }
  return row;
}

function price(value, required = false) {
  if (value === undefined && !required) return 0;
  const n = Number(value);
  if (value === undefined || !Number.isFinite(n) || n < 0) throw fail(503, 'This model’s price could not be bounded safely.');
  return n;
}

function localToolDefinitions(tools, depth = 0) {
  if (tools === undefined) return true;
  if (!Array.isArray(tools) || depth > 8) return false;
  return tools.every(tool => tool && typeof tool === 'object' && (
    ['function','custom'].includes(tool.type || 'function')
    || tool.type === 'namespace' && Array.isArray(tool.tools) && localToolDefinitions(tool.tools, depth + 1)
  ));
}

export function boundModelRequest(payload, route, task, model, quoteOnly = false) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw fail(400, 'A JSON model request is required.');
  if (payload.models !== undefined && (!Array.isArray(payload.models) || payload.models.some(id => id !== payload.model))) throw fail(403, 'Model fallback is not authorized for this task.');
  delete payload.models;
  if (payload.previous_response_id || payload.conversation || payload.background || payload.plugins?.length
    || !localToolDefinitions(payload.tools))
    throw fail(400, 'This request includes a hosted feature that is not enabled for prepaid Blue tasks.');
  if (task.purpose !== 'image' && (route === '/images' || payload.modalities?.includes('image')))
    throw fail(403, 'Image generation requires an image task.');
  if (payload.modalities?.some(mode => !['text','image'].includes(mode))) throw fail(400, 'This output type is not enabled.');
  payload.store = false;
  if (payload.provider?.options || payload.service_tier && !['auto','default'].includes(payload.service_tier))
    throw fail(400, 'This request includes an unbudgeted provider option.');
  // A master key must never permit a client to change billing attribution.
  delete payload.user; delete payload.session_id; delete payload.trace;
  if (route === '/images') return boundDedicatedImage(payload, task, model, quoteOnly);
  const p = model.pricing || {};
  const inputRate = Math.max(price(p.prompt, true), price(p.input_cache_read), price(p.input_cache_write));
  const outputRate = Math.max(price(p.completion, true), price(p.internal_reasoning), task.purpose === 'image' ? price(p.image_output ?? p.image_token) : 0);
  const requestRate = price(p.request);
  const imageRate = Math.max(price(p.image_output), price(p.image));
  const ceiling = Math.max(0, Number(task.provider_ceiling) - Number(task.committed));
  // Byte count is deliberately conservative for text. Multimodal inputs reserve
  // the complete advertised context because pixels/audio are not byte tokens.
  const serialized = JSON.stringify(payload);
  const context = Number(model.context_length);
  if (!Number.isSafeInteger(context) || context <= 0) throw fail(503, 'This model’s context limit could not be verified.');
  const multimodal = /"(?:image_url|input_image|input_audio|file|video_url)"\s*:/.test(serialized);
  const inputBound = multimodal ? context : Math.min(context, new TextEncoder().encode(serialized).length + 4096);
  const inputCost = inputBound * inputRate + requestRate;
  const limitField = route.startsWith('/responses') ? 'max_output_tokens' : 'max_tokens';
  const requestedLimit = payload[limitField] ?? payload.max_completion_tokens;
  if (requestedLimit !== undefined && (!Number.isSafeInteger(requestedLimit) || requestedLimit <= 0)) throw fail(400, 'Invalid output-token limit.');
  const advertisedLimit = Number(model.top_provider?.max_completion_tokens);
  const verifiedOutputLimit = Number.isSafeInteger(advertisedLimit) && advertisedLimit > 0;
  // Coding/reasoning turns can exhaust a blanket 4096-token default before
  // finishing a tool call. Use verified model headroom, with a bounded default.
  // Unknown model output caps and image tasks retain the conservative fallback.
  const defaultOutputLimit = task.purpose !== 'image' && verifiedOutputLimit ? 32768 : 4096;
  let outputBound = Math.min(context, verifiedOutputLimit ? advertisedLimit : context, requestedLimit || defaultOutputLimit);
  if (task.purpose === 'image') {
    if (!model.architecture?.output_modalities?.includes('image')) throw fail(400, 'The selected model cannot generate images.');
    if (payload.n !== undefined && payload.n !== 1) throw fail(400, 'Generate one image per request.');
    payload.n = 1;
    // No paid tools or extra variants can escape this dedicated image budget.
    if (payload.tools?.length) throw fail(400, 'Image tasks cannot execute tools.');
    if (route === '/images' && payload.size && !['512x512','1024x1024','auto'].includes(payload.size)) throw fail(400, 'Choose a standard image size.');
    if (payload.image_config?.image_size && !['1K','512'].includes(payload.image_config.image_size)) throw fail(400, 'Choose a standard image size.');
  }
  const fixed = inputCost + (task.purpose === 'image' ? imageRate : 0);
  if (quoteOnly) {
    // Only trusted proxy code supplies this quote to the service-only RPC.
    // Postgres applies the live task budget, not a client-provided balance.
    payload.provider = { ...(payload.provider && typeof payload.provider === 'object' ? payload.provider : {}),
      ...(task.purpose !== 'image' ? { sort: 'latency' } : {}),
      max_price: { prompt: inputRate * 1e6, completion: outputRate * 1e6, request: requestRate, image: imageRate } };
    if (payload.stream === true && route === '/chat/completions') payload.stream_options = { ...(payload.stream_options || {}), include_usage: true };
    return { payload, quote: { version: 1, purpose: task.purpose, fixed_cost: fixed, output_rate: outputRate, output_limit: outputBound } };
  }
  if (outputRate > 0) outputBound = Math.min(outputBound, Math.floor((ceiling - fixed) / outputRate));
  if (fixed > ceiling || outputBound < 1) throw fail(402, 'This task reached its model allowance.', 'blue_task_budget');
  if (route !== '/images') payload[limitField] = outputBound;
  if (payload.max_completion_tokens !== undefined) payload.max_completion_tokens = outputBound;
  const estimated = fixed + outputBound * outputRate;
  // Image APIs can bill in pixels or output tokens. Keep the entire task hold
  // unavailable to concurrent calls until authoritative image usage arrives.
  const hold = task.purpose === 'image' ? ceiling : Math.ceil(estimated * 1e10) / 1e10;
  payload.provider = { ...(payload.provider && typeof payload.provider === 'object' ? payload.provider : {}),
    ...(task.purpose !== 'image' ? { sort: 'latency' } : {}),
      max_price: { prompt: inputRate * 1e6, completion: outputRate * 1e6, request: requestRate, image: imageRate } };
  if (payload.stream === true && route === '/chat/completions') payload.stream_options = { ...(payload.stream_options || {}), include_usage: true };
  return { payload, hold };
}

function boundDedicatedImage(payload, task, model, quoteOnly = false) {
  if (task.purpose !== 'image' || !model.architecture?.output_modalities?.includes('image')) throw fail(403, 'This task cannot generate images.');
  const allowed = new Set(['model','prompt','n','stream','provider','size','resolution','aspect_ratio','quality','output_format','store']);
  if (Object.keys(payload).some(key => !allowed.has(key)) || payload.n !== undefined && payload.n !== 1)
    throw fail(400, 'Generate one image using standard image options.');
  if (payload.resolution && !['1K','512'].includes(payload.resolution) || payload.size && !['512x512','1024x1024','auto'].includes(payload.size)
    || payload.quality && !['auto','low','medium','standard'].includes(payload.quality)
    || payload.aspect_ratio && payload.aspect_ratio !== '1:1') throw fail(400, 'Choose a standard square image size and quality.');
  if (typeof payload.prompt !== 'string' || payload.prompt.length > 12000 || !payload.prompt.trim()) throw fail(400, 'Describe the image to generate.');
  const ceiling = Math.max(0, Number(task.provider_ceiling) - Number(task.committed));
  const endpoints = Array.isArray(model.imageEndpoints) ? model.imageEndpoints : [];
  const choices = endpoints.map(endpoint => {
    const lines = endpoint.pricing;
    if (!Array.isArray(lines) || !lines.length) return undefined;
    let cost = 0;
    for (const line of lines) {
      const rate = price(line.cost_usd, true);
      if (line.unit === 'token') {
        const input = /input/.test(line.billable);
        cost += rate * (input ? new TextEncoder().encode(payload.prompt).length + 4096 : 16384);
      } else if (['image','megapixel','request'].includes(line.unit)) cost += rate * (line.unit === 'megapixel' ? 1.05 : 1);
      else return undefined;
    }
    return typeof endpoint.provider_slug === 'string' && cost <= ceiling ? { slug: endpoint.provider_slug, cost } : undefined;
  }).filter(Boolean).sort((a,b) => a.cost-b.cost);
  if (!choices.length) throw fail(402, 'This image cannot safely fit the task’s current allowance.', 'blue_task_budget');
  const chosen = choices[0];
  payload.n = 1; payload.aspect_ratio = '1:1';
  delete payload.size; delete payload.store;
  if (endpoints.find(row => row.provider_slug === chosen.slug)?.supported_parameters?.resolution?.values?.includes('1K')) payload.resolution = '1K';
  payload.provider = { only: [chosen.slug], allow_fallbacks: false };
  if (quoteOnly) return { payload, quote: { version: 1, purpose: 'image', fixed_cost: chosen.cost, output_rate: 0, output_limit: null } };
  return { payload, hold: ceiling };
}

/** Normalize and price without reading a task. SQL clamps tokens under its task lock. */
export function prepareModelQuote(payload, route, model) {
  const purpose = route === '/images' || payload?.modalities?.includes('image') ? 'image' : 'text';
  return boundModelRequest(payload, route, { purpose, provider_ceiling: 1e12, committed: 0 }, model, true);
}

function enforceAdmission(prepared, admission, route) {
  const limit = admission.output_limit;
  if (admission.purpose !== prepared.quote.purpose || !Number.isFinite(Number(admission.hold_cost)) || Number(admission.hold_cost) < 0
    || prepared.quote.output_limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > prepared.quote.output_limit))
    throw fail(503, 'Blue could not confirm the enforced model allowance.');
  const payload = prepared.payload;
  if (route !== '/images') {
    payload[route.startsWith('/responses') ? 'max_output_tokens' : 'max_tokens'] = limit;
    if (payload.max_completion_tokens !== undefined) payload.max_completion_tokens = limit;
  }
  return payload;
}

export function observedUsage(value) {
  const response = value?.response || value;
  const raw = response?.usage;
  const id = response?.id || value?.id;
  const generationId = typeof id === 'string' && /^gen-[A-Za-z0-9_-]{4,196}$/.test(id) ? id : undefined;
  const terminal = value?.type ? ['response.completed','response.failed','response.incomplete'].includes(value.type)
    : value?.object?.endsWith('.chunk') ? Array.isArray(value.choices)
      && (value.choices.length === 0 || value.choices.some(choice => choice.finish_reason != null)) : true;
  const known = terminal && raw && typeof raw.cost === 'number' && Number.isFinite(raw.cost) && raw.cost >= 0;
  const tokens = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return { generationId, ...(known ? { cost: raw.cost, prompt: tokens(raw.prompt_tokens ?? raw.input_tokens),
    completion: tokens(raw.completion_tokens ?? raw.output_tokens) } : {}) };
}

async function relaySse(reader, route, send, observe) {
  const decoder = new TextDecoder();
  let buffer = '';
  let terminal = false;
  while (true) {
    const { done, value } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
      const event = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      if (event.length > MAX_JSON_RESPONSE) throw fail(502, 'The model event exceeded its size limit.');
      const data = event.split(/\r?\n/).filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart()).join('\n');
      let parsed;
      if (data && data !== '[DONE]') try { parsed = JSON.parse(data); } catch {}
      if (parsed) {
        await observe(parsed);
        const error = parsed.error || parsed.response?.error;
        const failed = error || ['error','response.failed'].includes(parsed.type)
          || parsed.choices?.some?.(choice => choice.finish_reason === 'error');
        if (failed) {
          const code = Number(error?.code ?? error?.status);
          const category = error?.metadata?.error_type || error?.error_type || error?.code;
          send(modelStreamFailure(route, Number.isInteger(code) && code >= 400 && code <= 599 ? code : 502, category));
          await reader.cancel().catch(() => {});
          return;
        }
        terminal ||= ['response.completed','response.incomplete'].includes(parsed.type)
          || Boolean(parsed.choices?.some?.(choice => choice.finish_reason != null));
      }
      terminal ||= data === '[DONE]';
      send(event + '\n\n');
    }
    if (buffer.length > MAX_JSON_RESPONSE) throw fail(502, 'The model event exceeded its size limit.');
    if (done) {
      if (!terminal || buffer.trim()) throw fail(502, 'The model stream ended before completion.');
      return;
    }
  }
}

/** @param {Request} request
 * @param {{env: Record<string, any>, fetcher?: typeof fetch, rpc?: (name: string, args: any) => Promise<any>, waitUntil?: (work: Promise<any>) => void, maxRequestBytes?: number}} options */
export async function handleBlueProxy(request, { env, fetcher = fetch, rpc: injectedRpc, waitUntil, maxRequestBytes = MAX_REQUEST }) {
  const rpc = injectedRpc || ((name, args) => proxyRpc(env, name, args, fetcher));
  let callId, claims, reserved = false, dispatched = false, fetchStarted = false, observed = {}, finalized = false;
  let atomicAttempt, atomicAttempted = false, usesAtomic = false;
  const upstreamController = new AbortController();
  const stop = () => upstreamController.abort('Blue caller disconnected');
  const persistObservation = async value => {
    const found = observedUsage(value);
    const firstGeneration = found.generationId && !observed.generationId;
    observed = { ...observed, ...Object.fromEntries(Object.entries(found).filter(([,v]) => v !== undefined)) };
    if (firstGeneration) {
      await rpc('observe_blue_proxy_generation', { call_id_param: callId, generation_id_param: found.generationId });
    }
  };
  let finishPending;
  const finishOnce = async (rejected = false) => {
    if (finalized || !reserved) return;
    if (dispatched && observed.cost === undefined && observed.generationId && !rejected) {
      // Only a generation ID observed from this call's upstream can be queried.
      // A client cannot supply another user's cheap generation to get a refund.
      try {
        const response = await fetcher(ORIGIN + '/generation?id=' + encodeURIComponent(observed.generationId), {
          headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY }, redirect: 'manual', signal: AbortSignal.timeout(5000), cache: 'no-store' });
        if (response.ok) {
          const value = (await response.json()).data;
          if (value?.id === observed.generationId && (value.finish_reason || value.cancelled === true)
            && typeof value.total_cost === 'number' && Number.isFinite(value.total_cost) && value.total_cost >= 0) {
            observed = { ...observed, cost: value.total_cost, prompt: value.tokens_prompt || 0, completion: value.tokens_completion || 0 };
          }
        }
      } catch { /* The durable reservation remains pending for cron. */ }
    }
    if (usesAtomic && !fetchStarted) {
      await rpc('release_blue_proxy_admission', { user_id_param: claims.sub, request_id_param: claims.task,
        call_id_param: callId, attempt_id_param: atomicAttempt });
      finalized = true; return;
    }
    if (!dispatched || !fetchStarted || rejected || observed.cost !== undefined) {
      await rpc('settle_blue_proxy_call', { call_id_param: callId, cost_param: observed.cost ?? 0,
        prompt_tokens_param: observed.prompt || 0, completion_tokens_param: observed.completion || 0, release_param: !fetchStarted });
      finalized = true;
      if (!usesAtomic) try {
        await releaseProxyHold(env, claims.task, callId, claims.sub, fetcher);
        await rpc('confirm_blue_proxy_redis_release', { call_id_param: callId });
      } catch { /* Durable cleanup outbox retries only settled calls, never on status polls. */ }
    }
    // Ambiguous transport/provider errors never release a possibly spent hold.
  };
  // Cancel and the stream pump may finish together. Share settlement work so
  // neither the durable RPC nor the Redis release is duplicated.
  const finish = (rejected = false) => {
    if (finalized || !reserved) return Promise.resolve();
    if (!finishPending) finishPending = finishOnce(rejected).finally(() => { finishPending = undefined; });
    return finishPending;
  };
  try {
    const base = proxyBaseUrl(env.BLUE_RUNTIME_PROXY_BASE_URL);
    const url = new URL(request.url);
    const expected = new URL(base);
    const route = url.pathname.slice(expected.pathname.length);
    if (request.method !== 'POST' || url.origin !== expected.origin || !url.pathname.startsWith(expected.pathname + '/') || url.search || !ROUTES.has(route))
      throw fail(404, 'Unsupported Blue model route.');
    if (!env.OPENROUTER_API_KEY) throw fail(503, 'Blue model service is not configured.');
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    claims = await verifyTaskTicket(token, env.BLUE_TASK_TICKET_SECRET, base);
    callId = request.headers.get('x-blue-call-id') || crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(callId)) throw fail(400, 'Invalid Blue model call ID.');
    const raw = await readBounded(request.body, maxRequestBytes, request.signal);
    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch { throw fail(400, 'Invalid JSON model request.'); }
    if (!claims.models.includes(payload?.model)) throw fail(403, 'This model is not authorized by the Blue task ticket.');
    const binding = { user_id_param: claims.sub, request_id_param: claims.task, device_hash_param: claims.device, model_param: payload.model };
    let encoded;
    const mode = 'required';
    if (!['auto','required','legacy'].includes(mode)) throw fail(503, 'Invalid Blue admission configuration.');
    if (mode !== 'legacy') {
      const model = await modelInfo(env, payload.model, fetcher, route);
      const prepared = prepareModelQuote(structuredClone(payload), route, model);
      atomicAttempt = crypto.randomUUID(); // Never accept attempt ownership from the desktop.
      atomicAttempted = true;
      let admission;
      try {
        admission = await rpc('admit_blue_proxy_call_v2', { ...binding, call_id_param: callId, attempt_id_param: atomicAttempt,
          payload_hash_param: await sha256(route + '\n' + JSON.stringify(prepared)), quote_param: prepared.quote });
      } catch (error) {
        {
          // Our HTTP dispatch has not started. Release ONLY this attempt, even
          // if admission committed but its response was lost. No blind retries.
          await rpc('release_blue_proxy_admission', { user_id_param: claims.sub, request_id_param: claims.task,
            call_id_param: callId, attempt_id_param: atomicAttempt }).catch(() => {});
          throw error;
        }
      }
      if (atomicAttempted) {
        if (admission?.accepted !== true) throw fail(409, 'This model call was already submitted. Its progress is saved; it was not replayed.');
        reserved = true; usesAtomic = true; dispatched = true;
        payload = enforceAdmission(prepared, admission, route);
        encoded = JSON.stringify(payload);
        request.signal.throwIfAborted();
      }
    }
    if (!usesAtomic) {
      const task = await rpc('authorize_blue_proxy_task', binding);
      const model = await modelInfo(env, payload.model, fetcher, route);
      const bounded = boundModelRequest(payload, route, task, model);
      payload = bounded.payload;
      encoded = JSON.stringify(payload);
      const reservation = await rpc('reserve_blue_proxy_call', { ...binding, call_id_param: callId, payload_hash_param: await sha256(route + '\n' + encoded), hold_cost_param: bounded.hold });
      if (reservation?.accepted !== true) throw fail(409, 'This model call was already submitted. Its progress is saved; it was not replayed.');
      reserved = true;
      await holdProxyCredits(env, { taskId: claims.task, userId: claims.sub, callId, amount: bounded.hold,
        ceiling: Math.max(0, Number(reservation.ceiling) - Number(reservation.spent)) }, fetcher);
      request.signal.throwIfAborted();
      dispatched = true;
      const accepted = await rpc('dispatch_blue_proxy_call', { call_id_param: callId });
      if (accepted !== true) { dispatched = false; throw fail(409, 'This task stopped before model dispatch.'); }
    }
    request.signal.addEventListener('abort', stop, { once: true });
    const turnTimeout = Math.max(1000, Math.min(900000, Number(env.BLUE_PROXY_MAX_TURN_MS) || 270000));
    const lifetime = setTimeout(() => upstreamController.abort('Blue model turn exceeded its time limit'), turnTimeout);
    if (payload.stream === true) {
      let keepalive;
      const stream = new ReadableStream({
        start(controller) {
          const send = value => controller.enqueue(new TextEncoder().encode(value));
          send(': Blue model request accepted\n\n');
          keepalive = setInterval(() => { try { send(': keepalive\n\n'); } catch { stop(); } }, 8000);
          const work = (async () => {
            let reader;
            let receivedHeaders = false;
            let headersTimedOut = false;
            const headersDeadline = turnTimeout > MAX_STREAM_HEADERS_WAIT_MS ? setTimeout(() => {
              headersTimedOut = true;
              upstreamController.abort('Blue model provider did not respond before the headers deadline');
            }, MAX_STREAM_HEADERS_WAIT_MS) : undefined;
            try {
              request.signal.throwIfAborted();
              upstreamController.signal.throwIfAborted();
              fetchStarted = true;
              const upstream = await fetcher(ORIGIN + route, { method: 'POST', headers: {
                Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json',
                'HTTP-Referer': 'https://blue.imergene.in', 'X-Title': 'Blue Desktop'
              }, body: encoded, redirect: 'manual', signal: upstreamController.signal, cache: 'no-store' });
              receivedHeaders = true;
              clearTimeout(headersDeadline);
              if (!upstream.ok) {
                const rejection = await readProviderRejection(upstream, upstreamController.signal);
                const reportedCategory = rejection?.error_type ?? rejection?.error?.metadata?.error_type
                  ?? rejection?.error?.error_type ?? rejection?.error?.code;
                const category = upstream.status === 429 ? 'rate_limit_exceeded'
                  : reportedCategory === 'stream_disconnected' ? undefined : reportedCategory;
                // Deliver the recognized rejection even if accounting cleanup
                // is delayed. The durable hold remains for reconciliation.
                await finish([400,401,402,403,404,413,422,429].includes(upstream.status)).catch(() => {});
                const metadata = upstream.status === 429 ? providerRateLimitMetadata(upstream, rejection) : undefined;
                send(modelStreamFailure(route, upstream.status, category, metadata));
                controller.close(); return;
              }
              reader = upstream.body?.getReader();
              if (!reader) throw fail(502, 'The model returned no response stream.');
              await relaySse(reader, route, send, persistObservation);
              await finish().catch(() => {}); controller.close();
            } catch {
              stop(); await reader?.cancel().catch(() => {}); await finish().catch(() => {});
              try {
                const startupTimeout = !receivedHeaders && (headersTimedOut
                  || upstreamController.signal.reason === 'Blue model turn exceeded its time limit');
                send(startupTimeout ? modelStreamFailure(route, 504, 'timeout') : modelStreamFailure(route, 502, 'stream_disconnected'));
                controller.close();
              } catch {}
            } finally { clearTimeout(headersDeadline); clearTimeout(lifetime); clearInterval(keepalive); request.signal.removeEventListener('abort', stop); }
          })();
          waitUntil?.(work);
        },
        async cancel() { stop(); clearInterval(keepalive); await finish().catch(() => {}); }
      });
      return new Response(stream, { headers: { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8' } });
    }
    let response;
    try {
      request.signal.throwIfAborted();
      fetchStarted = true;
      response = await fetcher(ORIGIN + route, { method: 'POST', headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json', 'HTTP-Referer': 'https://blue.imergene.in', 'X-Title': 'Blue Desktop' },
        body: encoded, redirect: 'manual', signal: upstreamController.signal, cache: 'no-store' });
    } catch (error) { clearTimeout(lifetime); throw error; }
    if (response.status === 429) {
      clearTimeout(lifetime);
      const rejection = await readProviderRejection(response, upstreamController.signal);
      request.signal.removeEventListener('abort', stop);
      await finish(true).catch(() => {});
      const metadata = providerRateLimitMetadata(response, rejection);
      return Response.json({ error: { code: 'provider_rate_limit', type: 'rate_limit_error',
        message: 'The selected model is temporarily rate limited. Retry later.',
        ...(metadata.limit_source ? { metadata: { limit_source: metadata.limit_source } } : {}) } },
      { status: 429, headers: { ...headers, ...metadata.headers } });
    }
    if (!response.ok) {
      clearTimeout(lifetime); request.signal.removeEventListener('abort', stop);
      await response.body?.cancel();
      await finish([400,401,402,403,404,413,422,429].includes(response.status));
      return errorResponse(fail(response.status >= 500 ? 502 : 400,
        'The model provider declined this request. Your saved task is preserved.', 'blue_provider_rejected'));
    }
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      try {
        const bytes = await readBounded(response.body, MAX_JSON_RESPONSE, upstreamController.signal);
        const value = JSON.parse(new TextDecoder().decode(bytes));
        await persistObservation(value); await finish();
        return new Response(bytes, { status: response.status, headers: { ...headers, 'Content-Type': 'application/json' } });
      } finally { clearTimeout(lifetime); request.signal.removeEventListener('abort', stop); }
    }
    const reader = response.body.getReader();
    const pump = async controller => {
      try {
        await relaySse(reader, route, value => controller.enqueue(new TextEncoder().encode(value)), persistObservation);
        await finish(); controller.close();
      } catch (error) {
        upstreamController.abort();
        await reader.cancel().catch(() => {});
        await finish().catch(() => {});
        controller.error(fail(502, 'The model stream ended before completion. Your task progress is saved.'));
      } finally { clearTimeout(lifetime); request.signal.removeEventListener('abort', stop); }
    };
    const stream = new ReadableStream({ start(controller) { const work = pump(controller); waitUntil?.(work); },
      async cancel() { stop(); await reader.cancel().catch(() => {}); await finish().catch(() => {}); } });
    return new Response(stream, { headers: { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8' } });
  } catch (error) {
    request.signal.removeEventListener('abort', stop);
    await finish().catch(() => {});
    return errorResponse(error.status ? error : fail(503, 'Blue could not confirm the model connection. Your task is saved.'));
  }
}
