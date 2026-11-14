import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {handleBlueProxy,prepareModelQuote,proxyRpc} from './blueInferenceProxy.mjs';
import {issueTaskTicket} from './blueTaskTicket.mjs';
const base='https://blue-by-imergene.vercel.app/api/runtime/proxy/v1';
const env={BLUE_RUNTIME_PROXY_BASE_URL:base,BLUE_TASK_TICKET_SECRET:'synthetic-ticket-secret-'+'a'.repeat(32),OPENROUTER_API_KEY:'synthetic-atomic-key'};
const model={id:'vendor/atomic',context_length:131072,pricing:{prompt:'0.0000001',completion:'0.0000002',request:'0'}};
async function fixture(options={}) {
  const claims={userId:randomUUID(),taskId:randomUUID(),deviceHash:'a'.repeat(64),models:[model.id],baseUrl:base};
  const ticket=await issueTaskTicket(claims,env.BLUE_TASK_TICKET_SECRET);
  const calls=[],posted=[];let attempt;
  const rpc=async(name,args)=>{
    calls.push({name,args});
    if(name==='admit_blue_proxy_call_v2') {
      attempt=args.attempt_id_param;
      if(options.admit) return options.admit(args);
      return {accepted:!options.duplicate,purpose:args.quote_param.purpose,hold_cost:.02,output_limit:100};
    }
    if(name==='release_blue_proxy_admission') {assert.equal(args.attempt_id_param,attempt);return true;}
    if(name==='settle_blue_proxy_call'||name==='observe_blue_proxy_generation')return true;
    if(name==='authorize_blue_proxy_task')return {purpose:'text',provider_ceiling:.2,committed:0};
    if(name==='reserve_blue_proxy_call')return {accepted:true,ceiling:.2,spent:0};
    if(name==='dispatch_blue_proxy_call'||name==='confirm_blue_proxy_redis_release')return true;
    throw Error(name);
  };
  const fetcher=async(url,init={})=>{
    if(String(url).includes('/models/user'))return Response.json({data:[model]});
    if(String(url)==='https://redis.example.test'){calls.push({redis:true});return Response.json({result:1});}
    if(String(url).endsWith('/chat/completions')) {
      posted.push(JSON.parse(init.body));
      if(options.upstream) return options.upstream(init);
      return Response.json({choices:[{message:{content:'Hello'}}],usage:{cost:.001,prompt_tokens:10,completion_tokens:5}});
    }
    throw Error('Unexpected fetch');
  };
  const request=(payload={})=>new Request(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+ticket.token,
    'Content-Type':'application/json','X-Blue-Call-Id':randomUUID(),'X-Blue-Attempt-Id':'untrusted'},
    body:JSON.stringify({model:model.id,messages:[{role:'user',content:'Hello'}],...payload})});
  return {calls,posted,request,run:req=>handleBlueProxy(req,{env:{...env,...options.env},fetcher,rpc})};
}
test('one atomic pre-dispatch RPC and zero Redis; output is clamped to SQL limit',async()=>{
  const f=await fixture();assert.equal((await f.run(f.request())).status,200);
  assert.equal(f.calls[0].name,'admit_blue_proxy_call_v2');assert.equal(f.calls.length,2);
  assert.equal(f.calls[1].name,'settle_blue_proxy_call');assert.equal(f.posted[0].max_tokens,100);
  assert.notEqual(f.calls[0].args.attempt_id_param,'untrusted');assert.equal(f.calls.some(c=>c.redis),false);
  assert.equal(JSON.stringify(f.calls).includes('Hello'),false,'no prompts in RPC');
});
test('lost atomic admission response releases only own attempt and never dispatches or retries',async()=>{
  const f=await fixture({admit:()=>{throw Error('Response lost after commit')}});
  assert.equal((await f.run(f.request())).status,503);assert.equal(f.posted.length,0);
  assert.deepEqual(f.calls.map(c=>c.name),['admit_blue_proxy_call_v2','release_blue_proxy_admission']);
});
test('duplicate response never releases the original in-flight call',async()=>{
  const f=await fixture({duplicate:true});assert.equal((await f.run(f.request())).status,409);
  assert.deepEqual(f.calls.map(c=>c.name),['admit_blue_proxy_call_v2']);assert.equal(f.posted.length,0);
});
test('uncertain upstream fetch leaves hold pending without any zero-cost release',async()=>{
  const f=await fixture({upstream:()=>{throw Error('socket reset')}});
  assert.equal((await f.run(f.request())).status,503);assert.equal(f.posted.length,1);
  assert.deepEqual(f.calls.map(c=>c.name),['admit_blue_proxy_call_v2']);
});
test('explicit provider rejection settles zero without Redis',async()=>{
  const f=await fixture({upstream:()=>new Response('private',{status:429})});assert.equal((await f.run(f.request())).status,429);
  assert.equal(f.calls.at(-1).args.cost_param,0);assert.equal(f.calls.some(c=>c.redis),false);
});
test('malformed SQL limits fail closed and release own admission before upstream fetch',async()=>{
  const f=await fixture({admit:()=>({accepted:true,purpose:'text',hold_cost:.02,output_limit:999999})});
  assert.equal((await f.run(f.request())).status,503);assert.equal(f.posted.length,0);
  assert.equal(f.calls.at(-1).name,'release_blue_proxy_admission');
});
test('thousands of streamed events have zero Redis calls and settle once',async()=>{
  const f=await fixture({upstream:()=>{
    const frames=Array.from({length:1500},()=> 'data: {"choices":[{"delta":{"content":"x"}}]}\n\n').join('')
      +'data: {"choices":[],"usage":{"cost":0.001}}\n\ndata: [DONE]\n\n';
    return new Response(frames,{headers:{'content-type':'text/event-stream'}});
  }});
  const response=await f.run(f.request({stream:true}));assert.match(await response.text(),/\[DONE\]/);
  assert.deepEqual(f.calls.map(c=>c.name),['admit_blue_proxy_call_v2','settle_blue_proxy_call']);
});
test('missing migration fallback is allowed only for exact absent-function response',async()=>{
  const e={NEXT_PUBLIC_SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic'};
  const absent=await proxyRpc(e,'admit_blue_proxy_call_v2',{},async()=>Response.json({code:'PGRST202',message:'Could not find public.admit_blue_proxy_call_v2 in schema cache'},{status:404})).catch(e=>e);
  assert.equal(absent.code,'blue_admission_not_installed');
  for(const value of [{status:503,code:'PGRST202'}, {status:404,code:'23505'}]) {
    const err=await proxyRpc(e,'admit_blue_proxy_call_v2',{},async()=>Response.json({code:value.code,message:'admit_blue_proxy_call_v2'},{status:value.status})).catch(e=>e);
    assert.notEqual(err.code,'blue_admission_not_installed');
  }
  const f=await fixture({env:{UPSTASH_REDIS_REST_URL:'https://redis.example.test',UPSTASH_REDIS_REST_TOKEN:'synthetic'},admit:()=>{throw absent;}});
  assert.equal((await f.run(f.request())).status,200);assert.equal(f.posted.length,1);
  assert.equal(f.calls.filter(c=>c.name==='admit_blue_proxy_call_v2').length,1);
  assert.equal(f.calls.some(c=>c.name==='release_blue_proxy_admission'),false);
});
test('required admission mode fails closed before migration; never silently selects legacy',async()=>{
  const f=await fixture({env:{BLUE_PROXY_ATOMIC_ADMISSION:'required'},admit:()=>{throw Object.assign(Error('Absent'),{code:'blue_admission_not_installed'});}});
  assert.equal((await f.run(f.request())).status,503);assert.equal(f.posted.length,0);
  assert.equal(f.calls.some(c=>c.name==='authorize_blue_proxy_task'),false);
});
test('server quotes retain provider price ceilings and standard image controls',()=>{
  const prepared=prepareModelQuote({model:model.id,messages:[],max_completion_tokens:8000,provider:{allow_fallbacks:true}},'/chat/completions',model);
  assert.equal(prepared.quote.output_limit,8000);assert.ok(prepared.payload.provider.max_price.prompt>0);
  assert.equal(prepared.payload.provider.allow_fallbacks,true);
  assert.throws(()=>prepareModelQuote({model:model.id,modalities:['image']},'/chat/completions',model));
});
