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
