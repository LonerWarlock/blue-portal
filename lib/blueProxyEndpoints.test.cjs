const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('./blueProxyEndpoints.mjs'),import('../edge/blue-proxy-worker.mjs')]);
const env = { BLUE_RUNTIME_PROXY_BASE_URL: 'https://blue-inference-proxy.blue-production.workers.dev/v1' };
test('Worker-first selection probes only readiness and coalesces concurrent ticket issuance', async () => {
  const [m] = await modules; let calls=0;
  const fetcher = async (url, init) => { calls++; assert.equal(url,env.BLUE_RUNTIME_PROXY_BASE_URL+'/health');
    assert.equal(init.method,undefined); assert.equal(init.redirect,'error');
    return Response.json({ runtime_protocol_version:2,proxy_stream_ready:true,inference_transport:'blue-task-ticket' }); };
  assert.deepEqual(await Promise.all([m.selectProxyBase(env,fetcher),m.selectProxyBase(env,fetcher)]),[env.BLUE_RUNTIME_PROXY_BASE_URL,env.BLUE_RUNTIME_PROXY_BASE_URL]);
  assert.equal(calls,1);
});
test('unready Worker selects a distinct Vercel audience before any inference is sent', async () => {
  const [m,t] = await modules;
  const unavailable={BLUE_RUNTIME_PROXY_BASE_URL:'https://blue-inference-proxy.unready.workers.dev/v1'};
  let calls=0;
  const selected=await m.selectProxyBase(unavailable,async url=>{calls++;assert.ok(url.endsWith('/health'));throw Error('offline');});
  assert.equal(selected,m.VERCEL_PROXY_BASE_URL);assert.equal(calls,1);
  const locked={BLUE_RUNTIME_PROXY_BASE_URL:'https://blue-inference-proxy.locked.workers.dev/v1',BLUE_RUNTIME_PROXY_FALLBACK_ENABLED:'false'};
  await assert.rejects(m.selectProxyBase(locked,async()=>new Response('',{status:503})),/No model request/);
  const ticket = await import('./blueTaskTicket.mjs');
  const signed=await ticket.issueTaskTicket({userId:'11111111-1111-4111-8111-111111111111',taskId:'blue-scope-test',deviceHash:'a'.repeat(64),models:['vendor/model'],baseUrl:selected},'a'.repeat(40));
  await assert.rejects(ticket.verifyTaskTicket(signed.token,'a'.repeat(40),unavailable.BLUE_RUNTIME_PROXY_BASE_URL));
  assert.equal((await ticket.verifyTaskTicket(signed.token,'a'.repeat(40),selected)).aud,selected);
});
test('only the Blue Worker name is trusted; URL credentials and unrelated hosts are rejected', async () => {
  const [m] = await modules;
  for (const value of ['https://other.attacker.workers.dev/v1','https://blue-inference-proxy.account.workers.dev.evil.test/v1',
    'https://blue-inference-proxy.account.workers.dev/v1?secret=x','https://user@blue-inference-proxy.account.workers.dev/v1']) {
    assert.throws(()=>m.configuredProxyBase({BLUE_RUNTIME_PROXY_BASE_URL:value}));
  }
});
test('Worker health requires six server settings and normal requests still require a ticket', async () => {
  const [,{default:worker,requiredSecrets}] = await modules;
  const url=env.BLUE_RUNTIME_PROXY_BASE_URL;
  assert.equal((await worker.fetch(new Request(url+'/health'),{},{})).status,503);
  const secrets=Object.fromEntries(requiredSecrets.map(name=>[name,'synthetic-'+ 'a'.repeat(32)]));
  const ready=await worker.fetch(new Request(url+'/health'),secrets,{});
  assert.equal(ready.status,200);assert.equal((await ready.json()).execution,'cloudflare-worker');
  const rejected=await worker.fetch(new Request(url+'/chat/completions',{method:'POST',body:'{}'}),secrets,{});
  assert.equal(rejected.status,401);
  assert.equal((await worker.fetch(new Request('https://other.example/v1/health'),secrets,{})).status,404);
});

test('task credentials are signed for Cloudflare when healthy, and Vercel only on fallback', async () => {
  const { readFileSync } = require('node:fs');
  const { runInNewContext } = require('node:vm');
  const ts = require('typescript');
  const [endpoints] = await modules;
  const tickets = await import('./blueTaskTicket.mjs');
  const source = ts.transpileModule(readFileSync(require.resolve('./blueProxyRuntime.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const secret = 'fixture-signing-secret-01234567890123456789';
  const model = 'vendor/model';
  const task = { user_id: '11111111-1111-4111-8111-111111111111',
    request_id: 'blue-test-ticket-route', device_hash: 'a'.repeat(64), runtime_transport: 'ticket' };
  const health = Response.json({ runtime_protocol_version: 2, proxy_stream_ready: true, inference_transport: 'blue-task-ticket' });
  for (const ready of [true, false]) {
    const worker = `https://blue-inference-proxy.credentials-${ready}.workers.dev/v1`;
    const exports = {};
    let activations = 0;
    const imports = {
      './blueTaskTicket.mjs': tickets,
      './blueProxyRedis.mjs': {},
      './supabaseAdmin': { supabaseAdmin: { async rpc(name) {
        assert.equal(name, 'activate_blue_proxy_task');
        activations++;
        return { error: null };
      } } },
      './blueProxyEndpoints.mjs': {
        selectProxyBase: settings => endpoints.selectProxyBase(settings, async url => {
          assert.equal(url, worker + '/health');
          return ready ? health.clone() : new Response('', { status: 503 });
        })
      }
    };
    runInNewContext(source, { exports, require: name => imports[name],
      process: { env: { BLUE_RUNTIME_PROXY_BASE_URL: worker, BLUE_TASK_TICKET_SECRET: secret, OPENROUTER_API_KEY: 'fixture-only' } } });
    const credential = await exports.mintBlueTaskCredential(task, [model]);
    const expected = ready ? worker : endpoints.VERCEL_PROXY_BASE_URL;
    const other = ready ? endpoints.VERCEL_PROXY_BASE_URL : worker;
    assert.equal(credential.base_url, expected);
    assert.equal((await tickets.verifyTaskTicket(credential.token, secret, expected)).aud, expected);
    await assert.rejects(tickets.verifyTaskTicket(credential.token, secret, other), /does not match/);
    assert.equal(activations, 1);
  }
});
