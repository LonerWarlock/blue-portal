import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const source=await readFile(new URL('./blueControlRateLimit.ts',import.meta.url),'utf8');
function limiter(admin) {
  const exports={};
  new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)
    (name=>{assert.equal(name,'./supabaseAdmin');return {supabaseAdmin:admin}},exports);
  return exports.checkBlueControlRateLimit;
}
test('shared database counters preserve polling/admission limits, isolation, rollover and service-only access',async()=>{
  const db=new PGlite(),owner=randomUUID(),other=randomUUID();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');
      create table public.blue_proxy_calls(id uuid primary key,state text,updated_at timestamptz default now());`);
    const migration=await readFile(new URL('../supabase/migrations/041_blue_runtime_control_limiter.sql',import.meta.url),'utf8');
    await db.exec(migration); await db.exec(migration);
    const check=limiter({rpc:async(name,args)=>{
      assert.equal(name,'limit_blue_runtime_control');
      const data=(await db.query('select limit_blue_runtime_control($1,$2,$3) result',[args.user_id_param,args.scope_param,args.identity_param])).rows[0].result;
      return {data,error:null};
    }});
    for(const [scope,limit] of [['status',30],['admit:trial',20],['admit:paid',60]]) {
      for(let i=0;i<limit;i++) assert.equal((await check(owner,scope,'task')).allowed,true);
      const denied=await check(owner,scope,'task'); assert.equal(denied.allowed,false); assert.equal(denied.configured,true);
      assert.ok(denied.retryAfterSeconds>0);
    }
    assert.equal((await check(other,'status','task')).allowed,true);
    assert.equal((await check(owner,'status','other-task')).allowed,true);
    await db.query("update blue_runtime_control_rate_windows set window_start=now()-interval '2 minutes'");
    assert.equal((await check(owner,'status','task')).remaining,29);
    const settled=randomUUID(),pending=randomUUID();
    await db.query("insert into blue_proxy_calls(id,state) values($1,'settled'),($2,'pending')",[settled,pending]);
    await db.query('select confirm_blue_proxy_redis_release($1)',[settled]);
    await db.query('select confirm_blue_proxy_redis_release($1)',[pending]);
    assert.ok((await db.query('select redis_released_at from blue_proxy_calls where id=$1',[settled])).rows[0].redis_released_at);
    assert.equal((await db.query('select redis_released_at from blue_proxy_calls where id=$1',[pending])).rows[0].redis_released_at,null);
    for(const role of ['anon','authenticated']) {
      const result=(await db.query("select has_function_privilege($1,'limit_blue_runtime_control(uuid,text,text)','execute') allowed",[role])).rows[0];
      assert.equal(result.allowed,false);
    }
  }finally{await db.close();}
});
test('control-plane limiter fails closed on missing migration, malformed data and storage failure',async()=>{
  for(const admin of [null,{rpc:async()=>({error:{message:'missing function'}})},{rpc:async()=>{throw Error('offline')}},
    {rpc:async()=>({data:{allowed:true,remaining:30,retry_after_seconds:0}})}]) {
    const result=await limiter(admin)(randomUUID(),'status','task');assert.equal(result.allowed,false);assert.equal(result.configured,false);
  }
});
test('routine activity/status polling and task admission contain no Redis calls',async()=>{
  for(const file of ['desktop/activity/route.ts','runtime/v1/tasks/route.ts','runtime/v1/tasks/[requestId]/route.ts','runtime/v1/tasks/[requestId]/heartbeat/route.ts']) {
    const route=await readFile(new URL('../app/api/'+file,import.meta.url),'utf8');
    assert.doesNotMatch(route,/checkRateLimit|redisCommand|UPSTASH_REDIS/);
    assert.match(route,/authenticateBlueKey|auth\.getUser/);
  }
});
