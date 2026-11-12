import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { issueTaskTicket } from '../lib/blueTaskTicket.mjs';

test('compiled Worker streams and settles a synthetic model turn in the real Workers runtime', async () => {
  const base='https://blue-inference-proxy.local-test.workers.dev/v1';
  const env={BLUE_TASK_TICKET_SECRET:'synthetic-ticket-secret-'+'a'.repeat(32),OPENROUTER_API_KEY:'synthetic-server-key',
    NEXT_PUBLIC_SUPABASE_URL:'https://database.example.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-db-key',
    UPSTASH_REDIS_REST_URL:'https://redis.example.test',UPSTASH_REDIS_REST_TOKEN:'synthetic-redis-key'};
  const calls=[]; let generations=0, settlements=0, redirectTest=false;
  const worker=new Miniflare(convertV4MiniflareOptions({name:'blue-local-test',modules:true,compatibilityDate:'2026-11-12',
    scriptPath:fileURLToPath(new URL('./.wrangler/dry-run/blue-proxy-worker.js',import.meta.url)),bindings:env,
    outboundService:async request=>{
      const url=new URL(request.url);calls.push(url.pathname);
      if(url.origin===env.UPSTASH_REDIS_REST_URL)return Response.json({result:1});
      if(url.origin===env.NEXT_PUBLIC_SUPABASE_URL){
        assert.equal(request.headers.get('apikey'),env.SUPABASE_SERVICE_ROLE_KEY);
        if(url.pathname.endsWith('/authorize_blue_proxy_task'))return Response.json({purpose:'text',provider_ceiling:.2,committed:0});
        if(url.pathname.endsWith('/reserve_blue_proxy_call'))return Response.json({accepted:true,ceiling:.2,spent:0});
        if(url.pathname.endsWith('/dispatch_blue_proxy_call')||url.pathname.endsWith('/observe_blue_proxy_generation'))return Response.json(true);
        if(url.pathname.endsWith('/confirm_blue_proxy_redis_release'))return Response.json(null);
        if(url.pathname.endsWith('/settle_blue_proxy_call')){settlements++;assert.equal((await request.json()).cost_param,.004);return Response.json({settled:true});}
      }
      if(url.origin==='https://openrouter.ai'){
        assert.equal(request.headers.get('authorization'),'Bearer '+env.OPENROUTER_API_KEY);
        if(url.pathname==='/api/v1/models/user')return Response.json({data:[{id:'vendor/model',context_length:131072,
          pricing:{prompt:'0.0000001',completion:'0.0000002',request:'0'}}]});
        if(url.pathname==='/api/v1/chat/completions'){
          generations++;assert.equal((await request.json()).model,'vendor/model');
          if(redirectTest)return new Response(null,{status:302,headers:{Location:'https://never-contact.example.test/collect'}});
          return new Response('data: {"id":"gen-worker-test","object":"chat.completion.chunk","choices":[],"usage":{"cost":0.004,"prompt_tokens":20,"completion_tokens":10}}\n\ndata: [DONE]\n\n',
            {headers:{'Content-Type':'text/event-stream'}});
        }
      }
      throw Error('Unexpected synthetic Worker request: '+url.origin+url.pathname);
    }}));
  try{
    assert.equal((await worker.dispatchFetch(base+'/health')).status,200);
    assert.equal((await worker.dispatchFetch(base+'/chat/completions',{method:'POST',body:'{}'})).status,401);
    assert.equal(calls.length,0);
    const ticket=await issueTaskTicket({userId:'11111111-1111-4111-8111-111111111111',taskId:'blue-runtime-integration',
      deviceHash:'a'.repeat(64),models:['vendor/model'],baseUrl:base},env.BLUE_TASK_TICKET_SECRET);
    const response=await worker.dispatchFetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+ticket.token,'Content-Type':'application/json'},
      body:JSON.stringify({model:'vendor/model',messages:[{role:'user',content:'Synthetic test'}],stream:true})});
    const text=await response.text();
    assert.equal(response.status,200,JSON.stringify({text,calls}));
    assert.match(text,/Blue model request accepted/);assert.match(text,/\[DONE\]/);
    assert.equal(text.includes(env.OPENROUTER_API_KEY),false);
    assert.equal(generations,1);assert.equal(settlements,1);
    assert.equal(calls.filter(path=>path==='/').length,2,'Worker uses only admission and settlement Redis requests');
    assert.ok(calls.indexOf('/rest/v1/rpc/reserve_blue_proxy_call')<calls.indexOf('/api/v1/chat/completions'));
    redirectTest=true;
    const redirected=await worker.dispatchFetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+ticket.token,'Content-Type':'application/json'},
      body:JSON.stringify({model:'vendor/model',messages:[{role:'user',content:'Synthetic redirect test'}],stream:true})});
    assert.match(await redirected.text(),/provider declined/i);
    assert.equal(generations,2); assert.equal(settlements,1);
  }finally{await worker.dispose();}
});
