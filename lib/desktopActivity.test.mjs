import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import * as activity from './desktopActivity.ts';

const owner = randomUUID(), other = randomUUID();
function run(overrides = {}) { return {run_id:randomUUID(),revision:1,kind:'chat',status:'started',provider:'unknown',model:null,
  engine:null,duration_ms:null,input_tokens:null,output_tokens:null,cache_read_tokens:null,cache_write_tokens:null,error_code:null,...overrides}; }
function batch(overrides = {}) { return {schema_version:1,session_id:randomUUID(),app_version:'0.1.32',presence:'active',runs:[run()],...overrides}; }
function terminal(start, overrides = {}) { return {...start,revision:2,status:'completed',provider:'blue',model:'anthropic/claude-sonnet-4.5',
  engine:'opencode',duration_ms:1000,input_tokens:10,output_tokens:15,cache_read_tokens:4,cache_write_tokens:2,...overrides}; }

test('strict metadata parser accepts start, terminal, heartbeat and nullable outbox presence',()=>{
  for(const input of [batch(),batch({runs:[]}),batch({presence:'closed',runs:[]}),batch({presence:null}),batch({runs:[terminal(run())]})]) {
    assert.deepEqual(activity.validateDesktopActivity(input),input);
  }
});
test('parser denies unknown payload/run fields rather than accidentally storing private content',()=>{
  for(const key of ['user_id','email','prompt','response','message','task','project','path','url','error','stack','device_id','cost']) {
    assert.equal(activity.validateDesktopActivity({...batch(),[key]:'private'}),null,key);
    assert.equal(activity.validateDesktopActivity(batch({runs:[run({[key]:'private'})]})),null,key);
  }
});
test('parser bounds counts, run count, UUIDs, versions, statuses, and requires every explicit nullable field',()=>{
  const first=run();
  for(const invalid of [batch({runs:Array.from({length:33},()=>run())}),batch({runs:[first,first]}),batch({session_id:'email@example.test'}),
    batch({app_version:'0.1.32 secret'}),batch({presence:'online'}),batch({presence:null,runs:[]}),batch({runs:[run({revision:1,status:'failed'})]}),
    batch({runs:[run({revision:2,status:'started'})]}),batch({runs:[run({error_code:'browser'})]}),batch({runs:[terminal(first,{error_code:'unknown'})]})]) {
    assert.equal(activity.validateDesktopActivity(invalid),null);
  }
  for(const count of [-1,1.5,2_147_483_648,'42',NaN,Infinity]) {
    assert.equal(activity.validateDesktopActivity(batch({runs:[terminal(run(),{input_tokens:count})]})),null);
  }
  const incomplete=run();delete incomplete.model;
  assert.equal(activity.validateDesktopActivity(batch({runs:[incomplete]})),null);
});
test('model identifiers exclude URLs, paths, email, controls, and common secret formats',()=>{
  for(const model of ['gpt-5.5','anthropic/claude-sonnet-4.5','google/gemini-2.5-pro:free','o3','openai/gpt-5']) assert.equal(activity.isDesktopModelId(model),true,model);
  for(const model of ['a'.repeat(129),'alice@example.test','hello world','https://example.test','https:/private','C:/Users','C:\\Users\\alice','../../secret','/tmp/key',
    'gpt\n5','sk-live-secret','openrouter/sk-or-v1-secret','gsk_key','provider/gsk-secret','github_pat_secret','provider/github_pat_secret',
    'sb_secret_value','eyJhbGciOiJIUzI1NiJ9','AIzaSecret','ghp_key','token:secret']) {
    assert.equal(activity.isDesktopModelId(model),false,model);
  }
});

let db;
const migration = await readFile(new URL('../supabase/migrations/035_desktop_activity_reporting.sql',import.meta.url),'utf8');
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key);create table wallets(user_id uuid primary key,balance numeric);
    insert into auth.users values('${owner}'),('${other}');insert into wallets values('${owner}',50);`);
  await db.exec(migration);
  await db.exec(migration);
});
after(async()=>{await db?.close();});
async function record(input,user=owner) {
  return (await db.query('select public.record_desktop_activity($1,$2,$3,$4,$5) result',
    [user,input.session_id,input.app_version,input.presence,JSON.stringify(input.runs)])).rows[0].result;
}
async function saved(id,user=owner) { return (await db.query('select * from desktop_task_runs where user_id=$1 and run_id=$2',[user,id])).rows[0]; }
async function session(id,user=owner) { return (await db.query('select * from desktop_app_sessions where user_id=$1 and session_id=$2',[user,id])).rows[0]; }

test('real SQL records one run and monotonic terminal revision without touching billing',async()=>{
  const initial=batch();assert.equal((await record(initial)).inserted,1);
  const before=await saved(initial.runs[0].run_id);assert.equal(before.status,'started');
  const end={...initial,presence:null,runs:[terminal(initial.runs[0])]};assert.equal((await record(end)).updated,1);
  const after=await saved(initial.runs[0].run_id);assert.equal(after.status,'completed');assert.equal(after.model,'anthropic/claude-sonnet-4.5');
  assert.deepEqual(after.started_at,before.started_at);assert.ok(after.finished_at);assert.equal(after.input_tokens,10);
  const replay=await record(end);assert.equal(replay.already_recorded,1);assert.deepEqual(await saved(initial.runs[0].run_id),after);
  assert.equal((await record({...initial,presence:null})).ignored_older,1);assert.deepEqual(await saved(initial.runs[0].run_id),after);
  assert.equal((await db.query('select balance from wallets where user_id=$1',[owner])).rows[0].balance,'50');
});
test('terminal-first delivery remains terminal when an older start arrives',async()=>{
  const start=run(),input=batch({presence:null,runs:[terminal(start,{status:'failed',error_code:'timeout'})]});
  await record(input);const before=await saved(start.run_id);
  assert.equal((await record({...input,runs:[start]})).ignored_older,1);assert.deepEqual(await saved(start.run_id),before);
  assert.equal((await session(input.session_id)).last_seen_at,null);
});
test('diagnostics store only the bounded category and never require task or conversation content',async()=>{
  const input=batch({presence:null,runs:[terminal(run({kind:'diagnostic'}),{status:'failed',provider:'unknown',model:null,engine:null,error_code:'internal'})]});
  assert.deepEqual(activity.validateDesktopActivity(input),input);await record(input);
  const result=await saved(input.runs[0].run_id);assert.equal(result.kind,'diagnostic');assert.equal(result.error_code,'internal');
  assert.equal(result.model,null);assert.equal((await session(input.session_id)).last_seen_at,null);
});
test('closed sessions cannot be reopened by stale heartbeats and outbox delivery is never presence',async()=>{
  const input=batch({runs:[]});await record(input);await record({...input,presence:'closed'});
  const closed=await session(input.session_id);assert.ok(closed.closed_at);
  await record(input);await record({...input,presence:null,runs:[terminal(run())]});
  assert.deepEqual(await session(input.session_id),closed);
  const offline=batch({presence:null,runs:[terminal(run())]});await record(offline);
  assert.equal((await session(offline.session_id)).last_seen_at,null);assert.equal((await session(offline.session_id)).closed_at,null);
});
test('SQL owner keys isolate identical run IDs and session IDs between accounts',async()=>{
  const input=batch();await record(input);await record({...input,runs:[{...input.runs[0],kind:'team'}]},other);
  assert.equal((await saved(input.runs[0].run_id)).kind,'chat');assert.equal((await saved(input.runs[0].run_id,other)).kind,'team');
});
test('immutable identity and terminal conflicts roll back the entire batch including presence',async()=>{
  const input=batch();await record(input);const end={...input,presence:null,runs:[terminal(input.runs[0])]};await record(end);
  const before=await saved(input.runs[0].run_id),beforeSession=await session(input.session_id);
  for(const bad of [terminal(input.runs[0],{status:'failed',error_code:'provider'}),terminal(input.runs[0],{model:'openai/gpt-5'}),
    terminal(input.runs[0],{provider:'openrouter'}),terminal(input.runs[0],{input_tokens:999}),terminal(input.runs[0],{kind:'team'})]) {
    await assert.rejects(record({...input,presence:'closed',runs:[bad]}),/conflicts/);
    assert.deepEqual(await saved(input.runs[0].run_id),before);assert.deepEqual(await session(input.session_id),beforeSession);
  }
  await assert.rejects(record({...end,session_id:randomUUID()}),/identity conflicts/);
});
test('SQL defense in depth rejects private fields, malicious model IDs, invalid counters and oversized batches',async()=>{
  for(const bad of [run({prompt:'private'}),run({model:'alice@example.test'}),run({model:'openai/sk-secret'}),run({model:'provider/gsk_secret'}),
    run({model:'github_pat_secret'}),run({model:'C:/Users'}),run({model:'https:/private'}),run({input_tokens:-1}),
    run({error_code:'raw error'}),run({revision:2}),run({duration_ms:1})]) {
    const input=batch({runs:[bad]});await assert.rejects(record(input));assert.equal(await session(input.session_id),undefined);
  }
  const tooMany=batch({runs:Array.from({length:33},()=>run())});await assert.rejects(record(tooMany),/Invalid activity batch/);
  const duplicate=run();await assert.rejects(record(batch({runs:[duplicate,duplicate]})),/Duplicate/);
});
test('RLS permits service-role reads only; regular and anonymous users cannot read, write or invoke reporting',async()=>{
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query('select * from public.desktop_task_runs'),/permission denied/);
      await assert.rejects(db.query('select * from public.desktop_app_sessions'),/permission denied/);
      await assert.rejects(record(batch()),/permission denied/);
    } finally {await db.exec('reset role');}
  }
  await db.exec('set role service_role');
  try {
    assert.ok(Number((await db.query('select count(*) as count from desktop_task_runs')).rows[0].count)>0);
    await assert.rejects(db.query('delete from desktop_task_runs'),/permission denied/);
    assert.equal((await record(batch())).accepted,true);
  } finally {await db.exec('reset role');}
});

const routeSource=await readFile(new URL('../app/api/desktop/activity/route.ts',import.meta.url),'utf8');
const routeCode=ts.transpileModule(routeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function routeAdapter({user={id:owner},authError=null,configured=true,allowed=true,rpcError=null,adminMissing=false,dbLimit=null}={}) {
  const calls=[];
  const admin={auth:{getUser:async token=>{calls.push({type:'auth',token});return {data:{user},error:authError};}},
    rpc:async(name,args)=>{calls.push({type:'rpc',name,args});if(name==='limit_desktop_activity') return {data:dbLimit,error:dbLimit?null:{message:'limiter unavailable'}};return {data:rpcError?null:{accepted:true},error:rpcError};}};
  const modules={'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
    '@/lib/supabaseAdmin':{supabaseAdmin:adminMissing?null:admin},'@/lib/desktopActivity':activity,
    '@/lib/trafficControl':{checkRateLimit:async(...args)=>{calls.push({type:'limit',args});return {configured,allowed};},rateLimitHeaders:()=>({'Retry-After':'60'})}};
  const exported={};new Function('require','exports',routeCode)(name=>{if(!(name in modules)) throw new Error(name);return modules[name]},exported);
  return {...exported,calls};
}
function post(input,headers={}) {return new Request('https://blue.test/api/desktop/activity',{method:'POST',headers:{authorization:'Bearer verified-jwt','content-type':'application/json',...headers},body:typeof input==='string'?input:JSON.stringify(input)});}
test('route verifies the JWT then binds every RPC to that identity, never a supplied owner',async()=>{
  const handler=routeAdapter(),input=batch();const response=await handler.POST(post(input));assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(handler.calls.map(call=>call.type),['auth','limit','rpc']);
  assert.equal(handler.calls[2].args.user_id_param,owner);assert.equal(handler.calls[2].args.session_id_param,input.session_id);
  const attack=routeAdapter();assert.equal((await attack.POST(post({...input,user_id:other}))).status,400);assert.equal(attack.calls.some(call=>call.type==='rpc'),false);
});
test('route rejects missing/unverified tokens before any database write and does not accept legacy x-api-key authentication',async()=>{
  for(const [options,headers] of [[{}, {authorization:''}],[{}, {authorization:'Bearer first, second'}],[{}, {authorization:'', 'x-api-key':'legacy'}],
    [{user:null},{}],[{authError:{message:'secret backend detail'}},{}]]) {
    const handler=routeAdapter(options),response=await handler.POST(post(batch(),headers));assert.equal(response.status,401);
    assert.equal(handler.calls.some(call=>call.type==='rpc'),false);assert.equal((await response.text()).includes('secret'),false);
  }
});
test('route fails closed on unavailable distributed limiting, honors rate limits and hides migration failures',async()=>{
  for(const [options,status] of [[{configured:false},503],[{allowed:false},429],[{rpcError:{message:'private SQL details'}},503],[{adminMissing:true},503]]) {
    const handler=routeAdapter(options),response=await handler.POST(post(batch()));assert.equal(response.status,status);
    assert.equal((await response.text()).includes('private SQL'),false);
    if(!options.rpcError)assert.equal(handler.calls.some(call=>call.type==='rpc'&&call.name==='record_desktop_activity'),false);
  }
});
test('route enforces both declared and streamed byte limits, malformed JSON and content type',async()=>{
  for(const [body,headers,status] of [[' '.repeat(65537),{},413],[batch(),{'content-length':'65537'},413],['{',{},400],
    [batch(),{'content-type':'text/plain'},415],[batch({runs:Array.from({length:33},()=>run())}),{},400]]) {
    const handler=routeAdapter();assert.equal((await handler.POST(post(body,headers))).status,status);assert.equal(handler.calls.some(call=>call.type==='rpc'),false);
  }
});


test('missing Redis uses the authenticated shared database limiter before ingesting once',async()=>{
  const handler=routeAdapter({configured:false,dbLimit:{allowed:true,remaining:119,retry_after_seconds:0}});
  const input=batch(),response=await handler.POST(post(input));assert.equal(response.status,200);
  const calls=handler.calls.filter(call=>call.type==='rpc');
  assert.deepEqual(calls.map(call=>call.name),['limit_desktop_activity','record_desktop_activity']);
  assert.ok(calls.every(call=>call.args.user_id_param===owner));
});

test('database denial or invalid limiter output never passes through to the ingest RPC',async()=>{
  for(const [dbLimit,status] of [[{allowed:false,remaining:0,retry_after_seconds:25},429],
    [{allowed:true,remaining:120,retry_after_seconds:0},503],[{allowed:'yes',remaining:10,retry_after_seconds:0},503],
    [{allowed:false,remaining:1,retry_after_seconds:10},503],[{allowed:true,remaining:10,retry_after_seconds:2},503]]){
    const handler=routeAdapter({configured:false,dbLimit});const response=await handler.POST(post(batch()));
    assert.equal(response.status,status);assert.equal(handler.calls.some(call=>call.name==='record_desktop_activity'),false);
    if(status===429)assert.equal(response.headers.get('retry-after'),'60');
  }
});
