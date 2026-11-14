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
    if(name==='settle_blue_proxy_call' && options.settle) return options.settle(args);
    if(name==='settle_blue_proxy_call'||name==='observe_blue_proxy_generation')return true;
    if(name==='authorize_blue_proxy_task')return {purpose:'text',provider_ceiling:.2,committed:0};
    if(name==='reserve_blue_proxy_call')return {accepted:true,ceiling:.2,spent:0};
    if(name==='dispatch_blue_proxy_call'||name==='confirm_blue_proxy_redis_release')return true;
    throw Error(name);
  };
  const fetcher=async(url,init={})=>{
    if(String(url).includes('/models/user'))return Response.json({data:[model]});
    if(String(url)==='https://redis.example.test'){calls.push({redis:true});return Response.json({result:1});}
    if(String(url).endsWith('/chat/completions') || String(url).endsWith('/responses')) {
      posted.push(JSON.parse(init.body));
      if(options.upstream) return options.upstream(init);
      return Response.json({choices:[{message:{content:'Hello'}}],usage:{cost:.001,prompt_tokens:10,completion_tokens:5}});
    }
    throw Error('Unexpected fetch');
  };
  const request=(payload={},route='/chat/completions')=>new Request(base+route,{method:'POST',headers:{Authorization:'Bearer '+ticket.token,
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

test('coding defaults use verified model headroom instead of truncating every turn at 4096',()=>{
  const dots={...model,context_length:512000,top_provider:{max_completion_tokens:460800}};
  assert.equal(prepareModelQuote({model:dots.id,messages:[]},'/responses',dots).quote.output_limit,32768);
  assert.equal(prepareModelQuote({model:dots.id,messages:[],max_output_tokens:8000},'/responses',dots).quote.output_limit,8000);
  assert.equal(prepareModelQuote({model:dots.id,messages:[],max_output_tokens:1024},'/responses',dots).quote.output_limit,1024);
  assert.equal(prepareModelQuote({model:dots.id,messages:[]},'/responses',{...dots,top_provider:{max_completion_tokens:2048}}).quote.output_limit,2048);
  assert.equal(prepareModelQuote({model:dots.id,messages:[]},'/responses',{...dots,top_provider:{max_completion_tokens:-1}}).quote.output_limit,4096);
  assert.equal(prepareModelQuote({model:dots.id,messages:[]},'/responses',model).quote.output_limit,4096);
});


test('streamed Responses provider rejections retain a recognized cause instead of false EOF, without leaking bodies or hitting Redis',async()=>{
  for(const [status,errorType,expectedCode,expectedMarker] of [
    [400,'context_length_exceeded','invalid_prompt','provider_context_length'],
    [400,'invalid_request','invalid_prompt','provider_request_validation'],
    [401,'authentication','server_error','provider_authentication'],
    [402,'payment_required','server_error','provider_payment_required'],
    [403,'content_policy_violation','image_content_policy_violation','provider_policy'],
    [429,'rate_limit_exceeded','rate_limit_exceeded','provider_rate_limit'],
    [503,'provider_overloaded','server_error','provider_overloaded']
  ]) {
    const f=await fixture({upstream:()=>Response.json({error:{message:'secret echoed prompt or key',metadata:{error_type:errorType,raw:'private provider data'}}},{status})});
    const response=await f.run(f.request({stream:true,input:[]},'/responses'));
    const text=await response.text();
    const event=JSON.parse(text.split('\n').find(line=>line.startsWith('data:')).slice(5));
    assert.equal(event.type,'response.failed');assert.equal(event.response.status,'failed');assert.equal(event.response.error.code,expectedCode);
    assert.match(event.response.error.message,new RegExp(expectedMarker));assert.match(event.response.error.message,new RegExp('HTTP '+status));
    assert.doesNotMatch(text,/secret echoed|private provider|synthetic-atomic-key|response.completed/);
    assert.equal(f.posted.length,1,'a rejection is never automatically replayed by the proxy');
    assert.deepEqual(f.calls.map(c=>c.name),status<500?['admit_blue_proxy_call_v2','settle_blue_proxy_call']:['admit_blue_proxy_call_v2']);
    if(status<500) assert.equal(f.calls.at(-1).args.cost_param,0);
  }
});

test('unrecognized, malformed and oversized rejection bodies preserve status without reflecting provider text',async()=>{
  for(const body of ['private provider HTML','x'.repeat(70000),JSON.stringify({error:{metadata:{error_type:'toString'},message:'private body'}})]) {
    const f=await fixture({upstream:()=>new Response(body,{status:400})});
    const response=await f.run(f.request({stream:true},'/responses'));const text=await response.text();
    assert.match(text,/event: response.failed/);assert.match(text,/provider_request_validation/);assert.match(text,/HTTP 400/);
    assert.doesNotMatch(text,/private body|private provider HTML|toString/);
    assert.equal(f.calls.some(c=>c.redis),false);
  }
});

test('a real transport loss has a distinct native error and never refunds unconfirmed spending',async()=>{
  const f=await fixture({upstream:()=>{throw Error('private socket information');}});
  const response=await f.run(f.request({stream:true},'/responses'));const text=await response.text();
  assert.match(text,/event: response.failed/);assert.match(text,/BLUE_UPSTREAM_STREAM_CLOSED/);
  assert.doesNotMatch(text,/private socket information/);assert.equal(f.posted.length,1);
  assert.deepEqual(f.calls.map(c=>c.name),['admit_blue_proxy_call_v2']);
});

test('credit settlement outage cannot replace a complete valid stream or erase the provider rejection',async()=>{
  for(const rejected of [false,true]) {
    const f=await fixture({settle:()=>{throw Error('private database outage');},upstream:()=>rejected
      ? Response.json({error:{metadata:{error_type:'invalid_request'}}},{status:400})
      : new Response('data: {"type":"response.completed","response":{"status":"completed","output":[],"usage":{"cost":0.001}}}\n\n', {headers:{'content-type':'text/event-stream'}})});
    const response=await f.run(f.request({stream:true},'/responses'));const text=await response.text();
    assert.match(text,rejected?/provider_request_validation/:/response.completed/);
    assert.doesNotMatch(text,/BLUE_UPSTREAM_STREAM_CLOSED|private database outage/);
    assert.equal(f.calls.filter(c=>c.name==='settle_blue_proxy_call').length,1);
  }
});


test('latency routing preserves privacy, provider restrictions and enforced price ceilings',()=>{
 const preferences={sort:'throughput',data_collection:'deny',zdr:true,only:['approved'],ignore:['blocked'],allow_fallbacks:false};
 const input={model:model.id,messages:[],provider:preferences};
 const result=prepareModelQuote(input,'/chat/completions',model);
 assert.equal(result.payload.provider.sort,'latency');
 for(const key of ['data_collection','zdr','only','ignore','allow_fallbacks'])assert.deepEqual(result.payload.provider[key],preferences[key]);
 assert.deepEqual(preferences.sort,'throughput','original preferences are not mutated');
 assert.equal(result.payload.provider.max_price.prompt,Number(model.pricing.prompt)*1e6);assert.equal(result.payload.provider.max_price.completion,Number(model.pricing.completion)*1e6);
 const free=prepareModelQuote({model:model.id,messages:[]},'/responses',{...model,pricing:{prompt:'0',completion:'0',request:'0'}});
 assert.equal(free.payload.provider.max_price.prompt,0);assert.equal(free.payload.provider.max_price.completion,0);
});
