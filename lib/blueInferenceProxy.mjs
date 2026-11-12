import { verifyTaskTicket, proxyBaseUrl, sha256 } from './blueTaskTicket.mjs';
import { holdProxyCredits, releaseProxyHold } from './blueProxyRedis.mjs';

const ORIGIN = 'https://openrouter.ai/api/v1';
const MAX_REQUEST = 8 * 1024 * 1024;
const MAX_JSON_RESPONSE = 32 * 1024 * 1024;
const ROUTES = new Set(['/chat/completions', '/responses', '/responses/compact', '/images']);
const headers = { 'Cache-Control': 'no-store, no-transform', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no' };
const fail = (status, message, code = 'blue_proxy_error') => Object.assign(new Error(message), { status, code });
const errorResponse = error => Response.json({ error: { message: error.message || 'Blue could not complete the model request.',
  code: error.code || 'blue_proxy_error', type: 'invalid_request_error' } }, { status: error.status || 503, headers });
const catalogueCache = new Map();

export async function proxyRpc(env, name, args, fetcher = fetch) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) throw fail(503, 'Blue credit storage is not configured.');
  const response = await fetcher(`${String(url).replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store'
  });
  if (!response.ok) {
    // Database errors never include request content or secrets in the response.
    let message = '';
    try { message = String((await response.json()).message || ''); } catch {}
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
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) throw fail(413, 'The model request or response exceeds Blue’s size limit.');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
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
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
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
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
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

export function boundModelRequest(payload, route, task, model) {
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
  if (route === '/images') return boundDedicatedImage(payload, task, model);
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
  const advertisedLimit = Number(model.top_provider?.max_completion_tokens || context);
  let outputBound = Math.min(Number.isSafeInteger(advertisedLimit) ? advertisedLimit : context, requestedLimit || 4096);
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
  if (outputRate > 0) outputBound = Math.min(outputBound, Math.floor((ceiling - fixed) / outputRate));
  if (fixed > ceiling || outputBound < 1) throw fail(402, 'This task reached its model allowance.', 'blue_task_budget');
  if (route !== '/images') payload[limitField] = outputBound;
  if (payload.max_completion_tokens !== undefined) payload.max_completion_tokens = outputBound;
  const estimated = fixed + outputBound * outputRate;
  // Image APIs can bill in pixels or output tokens. Keep the entire task hold
  // unavailable to concurrent calls until authoritative image usage arrives.
  const hold = task.purpose === 'image' ? ceiling : Math.ceil(estimated * 1e10) / 1e10;
  payload.provider = { ...(payload.provider && typeof payload.provider === 'object' ? payload.provider : {}),
    max_price: { prompt: inputRate * 1e6, completion: outputRate * 1e6, request: requestRate, image: imageRate } };
  if (payload.stream === true && route === '/chat/completions') payload.stream_options = { ...(payload.stream_options || {}), include_usage: true };
  return { payload, hold };
}

function boundDedicatedImage(payload, task, model) {
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
  return { payload, hold: ceiling };
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

/** @param {Request} request
 * @param {{env: Record<string, any>, fetcher?: typeof fetch, rpc?: (name: string, args: any) => Promise<any>, waitUntil?: (work: Promise<any>) => void}} options */
export async function handleBlueProxy(request, { env, fetcher = fetch, rpc: injectedRpc, waitUntil }) {
  const rpc = injectedRpc || ((name, args) => proxyRpc(env, name, args, fetcher));
  let callId, claims, reserved = false, dispatched = false, fetchStarted = false, observed = {}, finalized = false;
  const upstreamController = new AbortController();
  const stop = () => upstreamController.abort('Blue caller disconnected');
  const persistObservation = async value => {
    const found = observedUsage(value);
    if (found.generationId && !observed.generationId) {
      await rpc('observe_blue_proxy_generation', { call_id_param: callId, generation_id_param: found.generationId });
    }
    observed = { ...observed, ...Object.fromEntries(Object.entries(found).filter(([,v]) => v !== undefined)) };
  };
  const finish = async (rejected = false) => {
    if (finalized || !reserved) return;
    if (dispatched && observed.cost === undefined && observed.generationId && !rejected) {
      // Only a generation ID observed from this call's upstream can be queried.
      // A client cannot supply another user's cheap generation to get a refund.
      try {
        const response = await fetcher(ORIGIN + '/generation?id=' + encodeURIComponent(observed.generationId), {
          headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY }, redirect: 'error', signal: AbortSignal.timeout(5000), cache: 'no-store' });
        if (response.ok) {
          const value = (await response.json()).data;
          if (value?.id === observed.generationId && (value.finish_reason || value.cancelled === true)
            && typeof value.total_cost === 'number' && Number.isFinite(value.total_cost) && value.total_cost >= 0) {
            observed = { ...observed, cost: value.total_cost, prompt: value.tokens_prompt || 0, completion: value.tokens_completion || 0 };
          }
        }
      } catch { /* The durable reservation remains pending for cron. */ }
    }
    if (!dispatched || !fetchStarted || rejected || observed.cost !== undefined) {
      await rpc('settle_blue_proxy_call', { call_id_param: callId, cost_param: observed.cost ?? 0,
        prompt_tokens_param: observed.prompt || 0, completion_tokens_param: observed.completion || 0, release_param: !fetchStarted });
      finalized = true;
      await releaseProxyHold(env, claims.task, callId, fetcher).catch(() => {});
    }
    // Ambiguous transport/provider errors never release a possibly spent hold.
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
    const raw = await readBounded(request.body, MAX_REQUEST, request.signal);
    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch { throw fail(400, 'Invalid JSON model request.'); }
    if (!claims.models.includes(payload?.model)) throw fail(403, 'This model is not authorized by the Blue task ticket.');
    const binding = { user_id_param: claims.sub, request_id_param: claims.task, device_hash_param: claims.device, model_param: payload.model };
    const task = await rpc('authorize_blue_proxy_task', binding);
    const model = await modelInfo(env, payload.model, fetcher, route);
    const bounded = boundModelRequest(payload, route, task, model);
    payload = bounded.payload;
    const encoded = JSON.stringify(payload);
    const reservation = await rpc('reserve_blue_proxy_call', { ...binding, call_id_param: callId, payload_hash_param: await sha256(route + '\n' + encoded), hold_cost_param: bounded.hold });
    if (reservation?.accepted !== true) throw fail(409, 'This model call was already submitted. Its progress is saved; it was not replayed.');
    reserved = true;
    await holdProxyCredits(env, { taskId: claims.task, userId: claims.sub, callId, amount: bounded.hold,
      ceiling: Math.max(0, Number(reservation.ceiling) - Number(reservation.spent)) }, fetcher);
    request.signal.throwIfAborted();
    // Treat an ambiguous dispatch commit as spent until cron proves otherwise.
    dispatched = true;
    const accepted = await rpc('dispatch_blue_proxy_call', { call_id_param: callId });
    if (accepted !== true) { dispatched = false; throw fail(409, 'This task stopped before model dispatch.'); }
    request.signal.addEventListener('abort', stop, { once: true });
    const lifetime = setTimeout(() => upstreamController.abort('Blue model turn exceeded its time limit'), 270000);
    if (payload.stream === true) {
      let keepalive;
      const stream = new ReadableStream({
        start(controller) {
          const send = value => controller.enqueue(new TextEncoder().encode(value));
          send(': Blue model request accepted\n\n');
          keepalive = setInterval(() => { try { send(': keepalive\n\n'); } catch { stop(); } }, 8000);
          const work = (async () => {
            let reader;
            try {
              fetchStarted = true;
              const upstream = await fetcher(ORIGIN + route, { method: 'POST', headers: {
                Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json',
                'HTTP-Referer': 'https://blue.imergene.in', 'X-Title': 'Blue Desktop'
              }, body: encoded, redirect: 'error', signal: upstreamController.signal, cache: 'no-store' });
              if (!upstream.ok) {
                await upstream.body?.cancel();
                await finish([400,401,402,403,404,413,422,429].includes(upstream.status));
                send('data: ' + JSON.stringify({ error: { message: upstream.status === 429 ? 'The selected model is rate limited. Retry later.'
                  : 'The provider declined this model request. Your task is saved.', code: upstream.status } }) + '\n\n');
                controller.close(); return;
              }
              reader = upstream.body?.getReader();
              if (!reader) throw fail(502, 'The model returned no response stream.');
              const decoder = new TextDecoder(); let buffer = '';
              while (true) {
                const { done, value } = await reader.read(); if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let newline;
                while ((newline = buffer.indexOf('\n')) >= 0) {
                  const line = buffer.slice(0, newline).replace(/\r$/, ''); buffer = buffer.slice(newline + 1);
                  if (line.startsWith('data:') && line.length < MAX_JSON_RESPONSE) {
                    let data; try { data = JSON.parse(line.slice(5).trim()); } catch {}
                    if (data) await persistObservation(data);
                  }
                }
                if (buffer.length > MAX_JSON_RESPONSE) throw fail(502, 'The model event exceeded its size limit.');
                controller.enqueue(value);
              }
              await finish(); controller.close();
            } catch {
              stop(); await reader?.cancel().catch(() => {}); await finish().catch(() => {});
              try { send('data: ' + JSON.stringify({ error: { code: 502, message: 'The model stream ended before completion. Task progress is saved.' } }) + '\n\n'); controller.close(); } catch {}
            } finally { clearTimeout(lifetime); clearInterval(keepalive); request.signal.removeEventListener('abort', stop); }
          })();
          waitUntil?.(work);
        },
        async cancel() { stop(); clearInterval(keepalive); await finish().catch(() => {}); }
      });
      return new Response(stream, { headers: { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8' } });
    }
    let response;
    try {
      fetchStarted = true;
      response = await fetcher(ORIGIN + route, { method: 'POST', headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json', 'HTTP-Referer': 'https://blue.imergene.in', 'X-Title': 'Blue Desktop' },
        body: encoded, redirect: 'error', signal: upstreamController.signal, cache: 'no-store' });
    } catch (error) { clearTimeout(lifetime); throw error; }
    if (!response.ok) {
      clearTimeout(lifetime); request.signal.removeEventListener('abort', stop);
      await response.body?.cancel();
      await finish([400,401,402,403,404,413,422,429].includes(response.status));
      return errorResponse(fail(response.status === 429 ? 429 : response.status >= 500 ? 502 : 400,
        response.status === 429 ? 'The selected model is temporarily rate limited. Retry later.' : 'The model provider declined this request. Your saved task is preserved.', 'blue_provider_rejected'));
    }
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      try {
        const bytes = await readBounded(response.body, MAX_JSON_RESPONSE, upstreamController.signal);
        const value = JSON.parse(new TextDecoder().decode(bytes));
        await persistObservation(value); await finish();
        return new Response(bytes, { status: response.status, headers: { ...headers, 'Content-Type': 'application/json' } });
      } finally { clearTimeout(lifetime); request.signal.removeEventListener('abort', stop); }
    }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    const pump = async controller => {
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline;
          while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline).replace(/\r$/, ''); buffer = buffer.slice(newline + 1);
            if (line.startsWith('data:') && line.length < MAX_JSON_RESPONSE) {
              let data; try { data = JSON.parse(line.slice(5).trim()); } catch {}
              if (data) await persistObservation(data);
            }
          }
          if (buffer.length > MAX_JSON_RESPONSE) throw fail(502, 'The model stream exceeded its event limit.');
          controller.enqueue(value);
        }
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
