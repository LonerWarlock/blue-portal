const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = 'https://blue-by-imergene.vercel.app/api/runtime/proxy/v1';
const env = { BLUE_RUNTIME_PROXY_BASE_URL: base, BLUE_TASK_TICKET_SECRET: 'synthetic-ticket-secret-01234567890123456789',
  OPENROUTER_API_KEY: 'synthetic-server-key', UPSTASH_REDIS_REST_URL: 'https://redis.example.test', UPSTASH_REDIS_REST_TOKEN: 'synthetic-redis' };
const binding = { userId: '11111111-1111-4111-8111-111111111111', taskId: 'blue-ticket-test', deviceHash: 'a'.repeat(64), models: ['vendor/model'], baseUrl: base };
const task = { purpose: 'text', provider_ceiling: 0.2, committed: 0, spent: 0 };
const model = { id: 'vendor/model', context_length: 131072, pricing: { prompt: '0.0000001', completion: '0.0000002', request: '0' } };
const modules = Promise.all([import('./blueTaskTicket.mjs'), import('./blueInferenceProxy.mjs')]);

async function fixture(options = {}) {
  const [tickets, proxy] = await modules;
  const ticket = await tickets.issueTaskTicket(binding, env.BLUE_TASK_TICKET_SECRET);
  const calls = []; const settled = []; let generations = 0; let dispatched = 0;
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === 'authorize_blue_proxy_task') { if (options.stopped) throw Object.assign(new Error('Stopped task'), { status: 403 }); return task; }
    if (name === 'reserve_blue_proxy_call') return { accepted: !options.duplicate, ceiling: .2, spent: 0 };
    if (name === 'dispatch_blue_proxy_call') { dispatched++; return true; }
    if (name === 'observe_blue_proxy_generation') return true;
    if (name === 'confirm_blue_proxy_redis_release') return null;
    if (name === 'settle_blue_proxy_call') { settled.push(args); return { settled: true }; }
    throw new Error('Unexpected RPC ' + name);
  };
  const fetcher = async (url, init = {}) => {
    url = String(url); calls.push({ url, init });
    assert.equal(init.redirect, 'manual', 'Service credentials must never follow redirects, on Node or Workers.');
    if (url === env.UPSTASH_REDIS_REST_URL) {
      if (options.redisDown) throw new Error('Redis unavailable');
      return Response.json({ result: 1 });
    }
    if (url.includes('/models/user')) return Response.json({ data: [model] });
    if (url.includes('/generation?id=')) return Response.json({ data: { id: 'gen-proxy-test', finish_reason: 'stop', total_cost: .004, tokens_prompt: 20, tokens_completion: 10 } });
    if (url === 'https://openrouter.ai/api/v1/chat/completions') {
      generations++;
      assert.equal(init.headers.Authorization, 'Bearer synthetic-server-key');
      assert.equal(JSON.stringify(init).includes(ticket.token), false);
      if (options.upstream) return options.upstream(init);
      return Response.json({ id: 'gen-proxy-test', choices: [{ message: { content: 'Hello' } }], usage: { cost: .004, prompt_tokens: 20, completion_tokens: 10 } });
    }
    throw new Error('Unexpected external request ' + url);
  };
  const request = (payload = {}, token = ticket.token, route = '/chat/completions') => new Request(base + route, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Blue-Call-Id': randomUUID() },
    body: JSON.stringify({ model: 'vendor/model', messages: [{ role: 'user', content: 'Hello' }], stream: false, ...payload }) });
  return { ...proxy, ...tickets, calls, settled, ticket, request, run: request => proxy.handleBlueProxy(request, { env, fetcher, rpc }),
    generations: () => generations, dispatched: () => dispatched };
}

test('task tickets expire, reject tampering and cannot be replayed on another proxy', async () => {
  const [m] = await modules;
  const ticket = await m.issueTaskTicket(binding, env.BLUE_TASK_TICKET_SECRET, 1000000);
  const claims = await m.verifyTaskTicket(ticket.token, env.BLUE_TASK_TICKET_SECRET, base, 1000001);
  assert.equal(claims.task, binding.taskId); assert.equal(ticket.token.includes(env.OPENROUTER_API_KEY), false);
  await assert.rejects(m.verifyTaskTicket(ticket.token + 'x', env.BLUE_TASK_TICKET_SECRET, base, 1000001), /Invalid/);
  await assert.rejects(m.verifyTaskTicket(ticket.token, env.BLUE_TASK_TICKET_SECRET, base, 1700000), /expired/);
  await assert.rejects(m.verifyTaskTicket(ticket.token, env.BLUE_TASK_TICKET_SECRET, 'https://other.test/v1', 1000001));
});

test('only the server key reaches OpenRouter; actual upstream usage settles exactly once', async () => {
  const f = await fixture(); const response = await f.run(f.request());
  assert.equal(response.status, 200); assert.equal((await response.json()).choices[0].message.content, 'Hello');
  assert.equal(f.generations(), 1); assert.equal(f.settled.length, 1); assert.equal(f.settled[0].cost_param, .004);
  assert.equal(f.calls.some(call => call.name && /messages|Hello/.test(JSON.stringify(call.args))), false);
  assert.equal(f.calls.findIndex(call => call.name === 'reserve_blue_proxy_call') < f.calls.findIndex(call => call.name === 'dispatch_blue_proxy_call'), true);
  const redis = f.calls.filter(call => call.url === env.UPSTASH_REDIS_REST_URL).map(call => JSON.parse(call.init.body));
  assert.deepEqual(redis.map(command => command[0]), ['EVAL', 'ZREM']);
  assert.equal(redis[0][2], '1');
});

test('wrong model, retired task, invalid key, duplicate call and unknown paths never submit inference', async () => {
  for (const scenario of ['model','stopped','key','duplicate','path']) {
    const f = await fixture({ stopped: scenario === 'stopped', duplicate: scenario === 'duplicate' });
    const request = scenario === 'model' ? f.request({ model: 'vendor/other' }) : scenario === 'key' ? f.request({}, 'sk-or-v1-stolen')
      : scenario === 'path' ? f.request({}, f.ticket.token, '/keys') : f.request();
    const response = await f.run(request); assert.ok(response.status >= 400, scenario); assert.equal(f.generations(), 0, scenario);
  }
});

test('Redis outage fails closed and releases the durable pre-dispatch hold', async () => {
  const f = await fixture({ redisDown: true }); const response = await f.run(f.request());
  assert.equal(response.status, 503); assert.equal(f.generations(), 0); assert.equal(f.dispatched(), 0);
  assert.equal(f.settled.length, 1); assert.equal(f.settled[0].release_param, true);
});

test('ambiguous provider failure is not retried and cannot turn into a zero-cost refund', async () => {
  const f = await fixture({ upstream: () => { throw new Error('connection reset'); } });
  const response = await f.run(f.request());
  assert.equal(response.status, 503); assert.equal(f.generations(), 1); assert.equal(f.settled.length, 0);
});

test('SSE starts before the provider responds, preserves tools, observes split usage and settles', async () => {
  let release; const ready = new Promise(resolve => { release = resolve; });
  const f = await fixture({ upstream: async () => {
    await ready;
    const frames = 'data: ' + JSON.stringify({ id: 'gen-proxy-test', choices: [{ delta: { tool_calls: [{ id: 'call_test', function: { name: 'read_file', arguments: '{}' } }] } }] })
      + '\n\ndata: ' + JSON.stringify({ id: 'gen-proxy-test', choices: [], usage: { cost: .004, prompt_tokens: 20, completion_tokens: 10 } }) + '\n\ndata: [DONE]\n\n';
    const bytes = new TextEncoder().encode(frames);
    return new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 19)); c.enqueue(bytes.slice(19)); c.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  const response = await f.run(f.request({ stream: true }));
  assert.equal(response.status, 200); const reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /accepted/); release();
  let text = ''; while (true) { const { done, value } = await reader.read(); if (done) break; text += new TextDecoder().decode(value); }
  assert.match(text, /read_file/); assert.equal(f.settled.length, 1); assert.equal(f.settled[0].cost_param, .004);
  assert.equal(f.calls.filter(call => call.name === 'observe_blue_proxy_generation').length, 1);
  assert.deepEqual(f.calls.filter(call => call.url === env.UPSTASH_REDIS_REST_URL).map(call => JSON.parse(call.init.body)[0]), ['EVAL', 'ZREM']);
});

test('thousands of SSE events do not increase Redis calls or persist per-chunk usage', async () => {
  const f = await fixture({ upstream: () => new Response(new ReadableStream({start(c) {
    const encode = value => new TextEncoder().encode('data: '+JSON.stringify(value)+'\n\n');
    for(let i=0;i<1500;i++) c.enqueue(encode({id:'gen-many-events',object:'chat.completion.chunk',choices:[{delta:{content:'x'}}]}));
    c.enqueue(encode({id:'gen-many-events',object:'chat.completion.chunk',choices:[],usage:{cost:.004,prompt_tokens:20,completion_tokens:10}}));
    c.close();
  }}), {headers:{'Content-Type':'text/event-stream'}}) });
  const response = await f.run(f.request({stream:true}));
  await response.text();
  assert.equal(f.settled.length,1);
  assert.equal(f.calls.filter(call=>call.name==='observe_blue_proxy_generation').length,1);
  assert.deepEqual(f.calls.filter(call=>call.url===env.UPSTASH_REDIS_REST_URL).map(call=>JSON.parse(call.init.body)[0]),['EVAL','ZREM']);
});

test('cancel racing stream completion shares one settlement and one Redis release', async () => {
  let read, observed;
  const f = await fixture({upstream:()=>new Response(new ReadableStream({start(c) {read=c;},cancel(){}}),{headers:{'Content-Type':'text/event-stream'}})});
  const response=await f.run(f.request({stream:true}));
  const reader=response.body.getReader(); await reader.read();
  read.enqueue(new TextEncoder().encode('data: {"id":"gen-race-test","choices":[],"usage":{"cost":0.004}}\n\n'));
  await reader.read();
  read.close();
  await reader.cancel();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.settled.length,1);
  assert.equal(f.calls.filter(call=>call.url===env.UPSTASH_REDIS_REST_URL && JSON.parse(call.init.body)[0]==='ZREM').length,1);
});

test('provider rejection is sanitized and releases only the rejected call', async () => {
  const f = await fixture({ upstream: () => new Response('secret provider payload', { status: 429 }) });
  const response = await f.run(f.request()); assert.equal(response.status, 429);
  assert.doesNotMatch(await response.text(), /secret provider/); assert.equal(f.settled[0].cost_param, 0);
});

test('client cannot enable a hosted tool, paid plugin, other model or unbounded output', async () => {
  const [,m] = await modules;
  for (const extra of [{ plugins: [{ id: 'web' }] }, { previous_response_id: 'someone-elses-response' },
    { tools: [{ type: 'web_search' }] }, { models: ['vendor/other'] }, { modalities: ['image'] }, { max_tokens: -1 }]) {
    assert.throws(() => m.boundModelRequest({ model: 'vendor/model', messages: [], ...extra }, '/chat/completions', task, model));
  }
  const bounded = m.boundModelRequest({ model: 'vendor/model', messages: [], max_tokens: 1000000 }, '/chat/completions', task, model);
  assert.ok(bounded.hold <= .2); assert.ok(bounded.payload.max_tokens <= model.context_length);
});

test('namespaces cannot hide an unbudgeted hosted tool inside local tool definitions', async () => {
  const f = await fixture();
  const response = await f.run(f.request({ tools: [{ type: 'namespace', name: 'hidden', tools: [{ type: 'web_search' }] }] }));
  assert.equal(response.status, 400); assert.equal(f.generations(), 0); assert.equal(f.dispatched(), 0);
  const allowed = await f.run(f.request({ tools: [{ type: 'namespace', name: 'local', tools: [{ type: 'function', name: 'read_file' }] }] }));
  assert.equal(allowed.status, 200); assert.equal(f.generations(), 1);
});

test('intermediate response usage cannot prematurely settle an unfinished generation', async () => {
  const [,m] = await modules;
  assert.equal(m.observedUsage({ type: 'response.created', response: { id: 'gen-incomplete', usage: { cost: 0 } } }).cost, undefined);
  assert.equal(m.observedUsage({ object: 'chat.completion.chunk', choices: [{ delta: {} }], usage: { cost: 0 } }).cost, undefined);
});

test('dedicated image calls use verified endpoint prices without needing a text context window', async () => {
  const [,m] = await modules;
  const image = { id: 'vendor/image', architecture: { output_modalities: ['image'] }, imageEndpoints: [
    { provider_slug: 'image-provider', pricing: [{ billable: 'output_image', unit: 'image', cost_usd: .04 }], supported_parameters: { resolution: { values: ['1K','2K'] } } }
  ] };
  const bounded = m.boundModelRequest({ model: image.id, prompt: 'A lake' }, '/images', { ...task, purpose: 'image' }, image);
  assert.equal(bounded.hold,.2); assert.deepEqual(bounded.payload.provider.only,['image-provider']); assert.equal(bounded.payload.resolution,'1K');
  assert.throws(() => m.boundModelRequest({ model: image.id, prompt: 'A lake', n: 50 }, '/images', { ...task, purpose: 'image' }, image));
});
