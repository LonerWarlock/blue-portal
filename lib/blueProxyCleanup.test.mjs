import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import * as redis from './blueProxyRedis.mjs';
const source=await readFile(new URL('./blueProxyRuntime.ts',import.meta.url),'utf8');
test('settled Redis cleanup is retried after outage and acknowledged once, without polling every historical call',async()=>{
  let acknowledged=false,down=true; const commands=[];
  const row={id:'call-test',request_id:'task-test',user_id:'user-test'};
  const admin={from:()=>{
    let cleanup=false;
    const query={select:()=>query,in:()=>query,lt:()=>query,is:(field,value)=>{assert.equal(field,'redis_released_at');assert.equal(value,null);cleanup=true;return query;},
      limit:async()=>({data:cleanup&&!acknowledged?[row]:[],error:null})};return query;
  },rpc:async(name,args)=>{assert.equal(name,'confirm_blue_proxy_redis_release');assert.equal(args.call_id_param,row.id);acknowledged=true;return {error:null};}};
  const exports={},modules={'./blueTaskTicket.mjs':{},'./blueProxyRedis.mjs':redis,'./supabaseAdmin':{supabaseAdmin:admin},'./blueProxyEndpoints.mjs':{}};
  new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>modules[name],exports);
  const previousFetch=globalThis.fetch,previousUrl=process.env.UPSTASH_REDIS_REST_URL,previousToken=process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test'; process.env.UPSTASH_REDIS_REST_TOKEN='synthetic';
  globalThis.fetch=async(url,init)=>{commands.push(JSON.parse(init.body));if(down)throw Error('offline');return Response.json({result:1});};
  try {
    await exports.reconcileProxyCalls();assert.equal(acknowledged,false);
    down=false;await exports.reconcileProxyCalls();assert.equal(acknowledged,true);
    await exports.reconcileProxyCalls();assert.equal(commands.length,2,'acknowledged calls never send another Redis release');
    assert.deepEqual(commands.map(call=>call[0]),['ZREM','ZREM']);
    assert.equal(commands[1][1],'blue:proxy:v2:{user-test}:gate');
  } finally {
    globalThis.fetch=previousFetch;
    if(previousUrl===undefined)delete process.env.UPSTASH_REDIS_REST_URL;else process.env.UPSTASH_REDIS_REST_URL=previousUrl;
    if(previousToken===undefined)delete process.env.UPSTASH_REDIS_REST_TOKEN;else process.env.UPSTASH_REDIS_REST_TOKEN=previousToken;
  }
});
