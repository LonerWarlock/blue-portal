import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
async function load(file,modules) {
  const exports={}; const source=await readFile(new URL(file,import.meta.url),'utf8');
  new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)
    (name=>{if(name in modules)return modules[name];if(name==='crypto')return require('node:crypto');throw Error(name)},exports);
  return exports;
}
test('real website OTP routes use Postgres guards, enforce limits and issue zero Redis/fetch commands',async()=>{
  const db=new PGlite();let sends=0,verifications=0;const calls=[];
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Unexpected network I/O; no Redis client is allowed in this flow');};
  try {
    await db.exec('create role anon;create role authenticated;create role service_role;');
    const migration=await readFile(new URL('../supabase/migrations/042_blue_website_postgres_limiter.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);
    const admin={rpc:async(name,args)=>{
      assert.equal(name,'limit_blue_website_request');assert.match(args.identity_hash_param,/^[a-f0-9]{64}$/);
      assert.ok(!JSON.stringify(args).includes('@'));calls.push(args);
      return {data:(await db.query('select limit_blue_website_request($1,$2,$3,$4) result',
        [args.scope_param,args.identity_hash_param,args.limit_param,args.window_seconds_param])).rows[0].result,error:null};
    }};
    const traffic=await load('./trafficControl.ts',{'./supabaseAdmin':{supabaseAdmin:admin}});
    const auth={auth:{signInWithOtp:async()=>{sends++;return {error:null}},verifyOtp:async()=>{
      verifications++;return {data:{user:{id:'synthetic-user'},session:{access_token:'synthetic',refresh_token:'synthetic'}},error:null};
    }}};
    const modules={'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
      '@/lib/trafficControl':{...traffic,verifyTurnstile:async()=>({success:true,configured:true})},
      '@/lib/supabaseAdmin':{createSupabaseAuthClient:()=>auth}};
    const send=await load('../app/api/auth/send-otp/route.ts',modules),verify=await load('../app/api/auth/verify-otp/route.ts',modules);
    const request=(route,body)=>new Request('https://blue.test/api/auth/'+route,{method:'POST',
      headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.50'},body:JSON.stringify(body)});
    assert.equal((await send.POST(request('send-otp',{email:'test@example.invalid',turnstileToken:'synthetic'}))).status,200);
    assert.equal((await verify.POST(request('verify-otp',{email:'test@example.invalid',code:'123456'}))).status,200);
    assert.equal(calls.length,5);assert.equal(sends,1);assert.equal(verifications,1);
    for(let i=0;i<2;i++)assert.equal((await send.POST(request('send-otp',{email:'test@example.invalid'}))).status,200);
    assert.equal((await send.POST(request('send-otp',{email:'test@example.invalid'}))).status,429);assert.equal(sends,3);
    const before=await traffic.checkRateLimit('test:rollover','isolated',{limit:1,windowSeconds:60});assert.equal(before.allowed,true);
    assert.equal((await traffic.checkRateLimit('test:rollover','isolated',{limit:1,windowSeconds:60})).allowed,false);
    await db.exec("update blue_website_rate_windows set window_start=now()-interval '1 day'");
    assert.equal((await traffic.checkRateLimit('test:rollover','isolated',{limit:1,windowSeconds:60})).allowed,true);
    for(const role of ['anon','authenticated']) assert.equal((await db.query(
      "select has_function_privilege($1,'limit_blue_website_request(text,text,integer,integer)','execute') allowed",[role])).rows[0].allowed,false);
  } finally {globalThis.fetch=oldFetch;await db.close();}
});
test('website limiters fail closed when Postgres is unavailable; no Redis fallback',async()=>{
  for(const admin of [null,{rpc:async()=>({error:{message:'missing migration'}})},{rpc:async()=>{throw Error('offline')}}]) {
    const traffic=await load('./trafficControl.ts',{'./supabaseAdmin':{supabaseAdmin:admin}});
    const result=await traffic.checkRateLimit('otp:web:email','test@example.invalid',{limit:3,windowSeconds:3600});
    assert.equal(result.allowed,false);assert.equal(result.configured,false);
  }
});
test('only the inference Redis module can issue Redis commands; balances remain Postgres-backed',async()=>{
  const traffic=await readFile(new URL('./trafficControl.ts',import.meta.url),'utf8');
  assert.doesNotMatch(traffic,/UPSTASH|redisCommand|redis\.call|EVAL/);
  const rpc=await readFile(new URL('./blueProxyRuntime.ts',import.meta.url),'utf8');
  assert.match(rpc,/releaseProxyHold/); // recovery only after durable settlement
  for(const file of ['me/bootstrap/route.ts','blue-pro/wallet/route.ts','user/wallet/route.ts']) {
    const source=await readFile(new URL('../app/api/'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/redisCommand|holdProxyCredits|releaseProxyHold|UPSTASH/);
    assert.match(source,/supabase|wallet/i);
  }
  const payg=await readFile(new URL('./bluePayg.ts',import.meta.url),'utf8');
  assert.match(payg,/\.from\('wallets'\)/);assert.doesNotMatch(payg,/redisCommand|UPSTASH/);
  const summary=await readFile(new URL('./blueCreditSummary.ts',import.meta.url),'utf8');
  assert.doesNotMatch(summary,/redisCommand|UPSTASH/);assert.match(summary,/rpc|from\(/);
});
