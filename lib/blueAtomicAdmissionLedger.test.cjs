const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
let db;
const migration = name => fs.readFile(path.join(__dirname, '../supabase/migrations', name), 'utf8');
test.before(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    alter default privileges grant execute on functions to anon,authenticated;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
  for (const file of ['002_blue_pro.sql','004_payg_production.sql','005_custom_pack_access_tier.sql','007_zero_cost_reservations.sql',
    '010_blue_direct_runtime.sql','012_blue_runtime_delayed_usage_settlement.sql','013_expired_reservation_reconciliation.sql',
    '015_blue_runtime_heartbeat.sql','020_blue_runtime_global_queue.sql','024_blue_credit_clarity.sql','025_blue_runtime_approval_reviewer.sql','028_blue_runtime_free_approval_reviewer.sql']) {
    await db.exec((await migration(file)).replace('create extension if not exists pgcrypto;', ''));
  }
  await db.exec(`alter table auth.users add column email text;
    create table checkout_sessions(id uuid primary key,user_id uuid not null references auth.users(id),
      plan text not null,billing_cycle text not null,status text not null default 'pending',expires_at timestamptz not null,
      completed_at timestamptz,metadata jsonb default '{}');
    create table subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid unique not null references auth.users(id),
      plan text,status text,current_period_start timestamptz,current_period_end timestamptz,
      stripe_subscription_id text,stripe_customer_id text,metadata jsonb,updated_at timestamptz);`);
  for (const file of ['026_blue_subscription_billing_cycles.sql','031_blue_teams_checkout.sql','032_blue_teams_live_business_launch_test.sql',
    '033_blue_teams_admin_grants.sql','034_blue_teams_plan_transitions.sql','035_desktop_activity_reporting.sql',
    '036_blue_teams_credits_and_platform_fee.sql','037_blue_runtime_replacement_free_reviewer.sql','039_blue_task_ticket_proxy.sql','041_blue_runtime_control_limiter.sql','044_blue_atomic_proxy_admission.sql']) await db.exec(await migration(file));
});
test.after(async () => { await db?.close(); });
async function query(sql, args = []) { return (await db.query(sql, args)).rows; }
async function user() {
  const id = randomUUID();
  await query('insert into auth.users(id) values($1)', [id]);
  await query("insert into wallets(user_id,account_type,blue_credits) values($1,'pro_payg',10)", [id]);
  await query("insert into blue_profiles(user_id,status,total_credits_purchased,access_tier) values($1,'active',25,'full')", [id]);
  return id;
}
async function admit(owner, feature = 'project', free = false) {
  const id = 'proxy-' + randomUUID();
  const args = [owner,id,'a'.repeat(64),'b'.repeat(64),'vendor/model','normal',free,'full',free ? 0 : .2,
    100,500,new Date(Date.now()+120000).toISOString(),new Date(Date.now()+3600000).toISOString(),null,feature,'text'];
  await query('select admit_blue_runtime_task_v5(' + args.map((_,i) => '$'+(i+1)).join(',') + ')', args);
  await query('select activate_blue_proxy_task($1,$2,$3)', [owner,id,['vendor/model']]);
  return id;
}
async function reserve(owner, task, amount = .1, id = randomUUID()) {
  const result = await query('select reserve_blue_proxy_call($1,$2,$3,$4,$5,$6,$7) result',
    [owner,task,'a'.repeat(64),'vendor/model',id,'c'.repeat(64),amount]);
  return { id, ...result[0].result };
}
async function settle(id, cost, release = false) {
  return query('select settle_blue_proxy_call($1,$2,20,10,$3)', [id,cost,release]);
}

const quote={version:1,purpose:'text',fixed_cost:.01,output_rate:.00001,output_limit:4096};
async function atomic(owner,task,q=quote,id=randomUUID(),attempt=randomUUID(),hash='d'.repeat(64)) {
  return {id,attempt,...(await query('select admit_blue_proxy_call_v2($1,$2,$3,$4,$5,$6,$7,$8) result',
    [owner,task,'a'.repeat(64),'vendor/model',id,hash,attempt,q]))[0].result};
}
async function release(owner,task,call,attempt=call.attempt) {
  return (await query('select release_blue_proxy_admission($1,$2,$3,$4) released',[owner,task,call.id,attempt]))[0].released;
}
test('additive migration reapplies and preserves legacy ledger/cleanup and privilege boundaries',async()=>{
  const owner=await user(),task=await admit(owner),old=await reserve(owner,task,.01);
  await db.exec(await migration('044_blue_atomic_proxy_admission.sql'));
  const row=(await query('select * from blue_proxy_calls where id=$1',[old.id]))[0];
  assert.equal(row.admission_version,1);assert.equal(row.redis_hold_required,true);assert.equal(row.redis_released_at,null);
  for(const role of ['anon','authenticated']) {
    for(const fn of ['admit_blue_proxy_call_v2(uuid,text,text,text,uuid,text,uuid,jsonb)','release_blue_proxy_admission(uuid,text,uuid,uuid)'])
      assert.equal((await query('select has_function_privilege($1,$2,\'execute\') allowed',[role,fn]))[0].allowed,false);
    assert.equal((await query("select has_table_privilege($1,'blue_proxy_rate_windows','select') allowed",[role]))[0].allowed,false);
  }
});
test('atomic admission commits dispatch intent, quote limits and no-Redis marker together',async()=>{
  const owner=await user(),task=await admit(owner),call=await atomic(owner,task);
  assert.equal(call.accepted,true);assert.equal(call.output_limit,4096);assert.equal(call.hold_cost,.05096);
  const row=(await query('select * from blue_proxy_calls where id=$1',[call.id]))[0];
  assert.equal(row.state,'dispatching');assert.equal(row.admission_attempt_id,call.attempt);
  assert.equal(row.redis_hold_required,false);assert.ok(row.redis_released_at);
  assert.equal(Number((await query('select proxy_committed_cost from blue_runtime_tasks where request_id=$1',[task]))[0].proxy_committed_cost),call.hold_cost);
  assert.equal((await query("select * from blue_credit_events where call_id=$1 and kind='call_hold'",[call.id])).length,1);
});
test('remaining budget shrinks the output cap atomically; racing specialists never over-reserve',async()=>{
  const owner=await user(),task=await admit(owner);
  await reserve(owner,task,.18);
  const call=await atomic(owner,task); assert.equal(call.output_limit,1000);assert.equal(call.hold_cost,.02);
  await assert.rejects(atomic(owner,task),/allowance exhausted/);
  const otherTask=await admit(owner);
  const results=await Promise.allSettled(Array.from({length:12},()=>atomic(owner,otherTask,{...quote,fixed_cost:.06,output_rate:0})));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,3);
  assert.ok(Number((await query('select proxy_committed_cost from blue_runtime_tasks where request_id=$1',[otherTask]))[0].proxy_committed_cost)<=.2);
});
test('duplicates are not replayed; altered payload/model/task/owner cannot reuse a call ID',async()=>{
  const owner=await user(),task=await admit(owner),call=await atomic(owner,task);
  assert.equal((await atomic(owner,task,quote,call.id)).accepted,false);
  await assert.rejects(atomic(owner,task,quote,call.id,randomUUID(),'f'.repeat(64)),/identity conflict/);
  const task2=await admit(owner);await assert.rejects(atomic(owner,task2,quote,call.id),/identity conflict/);
  const other=await user(),otherTask=await admit(other);await assert.rejects(atomic(other,otherTask,quote,call.id),/identity conflict/);
  assert.equal(await release(owner,task,call,randomUUID()),false,'duplicate attempt cannot release original');
  assert.equal(await release(other,otherTask,call),false);
  assert.equal(await release(owner,task,call),true); assert.equal(await release(owner,task,call),true);
  assert.equal((await atomic(owner,task,quote,call.id)).accepted,false,'released IDs still cannot replay');
});
test('cancel, expiry, device and profile checks prevent new dispatch with no side effects',async()=>{
  for(const scenario of ['stop','expired','device','profile','blocked']) {
    const owner=await user(),task=await admit(owner);
    if(scenario==='stop')await query("update blue_runtime_tasks set state='stopping' where request_id=$1",[task]);
    if(scenario==='expired')await query("update blue_runtime_tasks set expires_at=now()-interval '1 second' where request_id=$1",[task]);
    if(scenario==='device')await query("update blue_runtime_tasks set device_hash=$2 where request_id=$1",[task,'e'.repeat(64)]);
    if(scenario==='profile')await query("update blue_profiles set status='suspended' where user_id=$1",[owner]);
    if(scenario==='blocked')await query("insert into blue_runtime_model_blocks(model,reason) values('vendor/model','test') on conflict do nothing");
    await assert.rejects(atomic(owner,task),/access denied/);
    assert.equal((await query('select * from blue_proxy_calls where request_id=$1',[task])).length,0);
    if(scenario==='blocked')await query("delete from blue_runtime_model_blocks where model='vendor/model'");
  }
});
test('free tasks keep zero budget but retain concurrency cap',async()=>{
  const owner=await user(),task=await admit(owner,'project',true);
  const free={...quote,fixed_cost:0,output_rate:0};
  const results=await Promise.allSettled(Array.from({length:10},()=>atomic(owner,task,free)));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,8);
  assert.match(results.find(x=>x.status==='rejected').reason.message,/Too many active/);
  await assert.rejects(atomic(owner,task,quote),/Too many active/);
});
test('legacy and new calls share one account rate limit across tasks, with minute rollover',async()=>{
  const owner=await user(),one=await admit(owner),two=await admit(owner),free={...quote,fixed_cost:0,output_rate:0};
  for(let i=0;i<120;i++) {
    if(i%2){const c=await reserve(owner,one,0);await settle(c.id,0,true);}
    else {const c=await atomic(owner,two,free);await release(owner,two,c);}
  }
  await assert.rejects(atomic(owner,two,free),/rate limit/); await assert.rejects(reserve(owner,one,0),/rate limit/);
  assert.equal((await query('select requests from blue_proxy_rate_windows where user_id=$1',[owner]))[0].requests,120);
  await query("update blue_proxy_rate_windows set window_start=now()-interval '2 minutes' where user_id=$1",[owner]);
  assert.equal((await atomic(owner,two,free)).accepted,true);
});
test('unknown dispatched usage remains held; authoritative usage settles once and wallet is protected',async()=>{
  const owner=await user(),task=await admit(owner),call=await atomic(owner,task);
  assert.equal((await query("select finish_blue_proxy_task($1,$2,'stopped') result",[owner,task]))[0].result.pending,true);
  assert.equal((await query('select state from blue_proxy_calls where id=$1',[call.id]))[0].state,'dispatching');
  await query('select observe_blue_proxy_generation($1,$2)',[call.id,'gen-atomic-test']);
  assert.equal(await release(owner,task,call),false,'a generation cannot be zero-refunded');
  await settle(call.id,.02);await settle(call.id,.02);
  assert.equal((await query("select * from blue_credit_events where call_id=$1 and kind='call_usage'",[call.id])).length,1);
  await query("select finish_blue_proxy_task($1,$2,'stopped')",[owner,task]);
  assert.equal(Number((await query('select blue_credits from wallets where user_id=$1',[owner]))[0].blue_credits),9.98);
});
test('image requests reserve the full remaining allowance and preserve exclusive budget',async()=>{
  const owner=await user(),task=await admit(owner);
  await query("update blue_runtime_tasks set proxy_purpose='image' where request_id=$1",[task]);
  const image={version:1,purpose:'image',fixed_cost:.04,output_rate:0,output_limit:null};
  const call=await atomic(owner,task,image);assert.equal(call.hold_cost,.2);assert.equal(call.output_limit,null);
  await assert.rejects(atomic(owner,task,image),/allowance exhausted/);
  await release(owner,task,call);assert.equal((await atomic(owner,task,image)).accepted,true);
});
test('invalid quotes roll back without inserting a rate window or call',async()=>{
  const owner=await user(),task=await admit(owner);
  for(const invalid of [{...quote,version:undefined},{...quote,output_limit:undefined},{...quote,fixed_cost:undefined},{...quote,output_rate:undefined},{...quote,version:0},{...quote,fixed_cost:-1},{...quote,output_rate:'0'},
    {...quote,output_limit:null},{...quote,output_limit:1.2},{...quote,purpose:'image'}])await assert.rejects(atomic(owner,task,invalid));
  assert.equal((await query('select * from blue_proxy_calls where request_id=$1',[task])).length,0);
  assert.equal((await query('select * from blue_proxy_rate_windows where user_id=$1',[owner])).length,0);
});
test('bounded synthetic load: 80 accounts × 20 calls, one admission transaction each',async()=>{
  const jobs=await Promise.all(Array.from({length:80},async()=>{const owner=await user();return {owner,task:await admit(owner)};}));
  const timings=[],start=performance.now();
  await Promise.all(jobs.map(async({owner,task})=>{
    for(let i=0;i<20;i++) {const begin=performance.now(),c=await atomic(owner,task,{...quote,fixed_cost:.001,output_rate:0});
      timings.push(performance.now()-begin);await settle(c.id,.0005);}
  }));
  assert.equal(timings.length,1600);
  for(const {owner,task} of jobs) {
    const row=(await query('select provider_cost,proxy_committed_cost from blue_runtime_tasks where request_id=$1',[task]))[0];
    assert.equal(Number(row.provider_cost),.01);assert.equal(Number(row.proxy_committed_cost),.01);
    assert.equal((await query('select count(*)::int n from blue_proxy_calls where request_id=$1',[task]))[0].n,20);
    const rate=(await query('select requests from blue_proxy_rate_windows where user_id=$1',[owner]))[0].requests;assert.ok(rate>=1 && rate<=20);
  }
  timings.sort((a,b)=>a-b);
  console.log(JSON.stringify({synthetic_calls:1600,elapsed_ms:Math.round(performance.now()-start),
    p50_ms:Math.round(timings[800]),p95_ms:Math.round(timings[1520]),note:'PGlite single-process queue; not a Supabase Free capacity benchmark'}));
});

test('real shared proxy + actual migrated SQL admit, dispatch and settle with zero Redis',async()=>{
  const {handleBlueProxy}=await import('./blueInferenceProxy.mjs');
  const {issueTaskTicket}=await import('./blueTaskTicket.mjs');
  const owner=await user(),task=await admit(owner),calls=[],base='https://blue-by-imergene.vercel.app/api/runtime/proxy/v1';
  const env={BLUE_RUNTIME_PROXY_BASE_URL:base,BLUE_PROXY_ATOMIC_ADMISSION:'required',
    OPENROUTER_API_KEY:'synthetic-ledger-model-key',BLUE_TASK_TICKET_SECRET:'synthetic-ticket-secret-'+'a'.repeat(32)};
  const ticket=await issueTaskTicket({userId:owner,taskId:task,deviceHash:'a'.repeat(64),models:['vendor/model'],baseUrl:base},env.BLUE_TASK_TICKET_SECRET);
  let fetches=0;
  const response=await handleBlueProxy(new Request(base+'/chat/completions',{method:'POST',
    headers:{Authorization:'Bearer '+ticket.token,'content-type':'application/json'},
    body:JSON.stringify({model:'vendor/model',messages:[{role:'user',content:'Synthetic integration'}],max_tokens:50000})}),{
    env, rpc:async(name,args)=>{
      calls.push(name);
      const keys=Object.keys(args),values=Object.values(args);
      return (await query('select '+name+'('+keys.map((k,i)=>k+'=> $'+(i+1)).join(',')+') result',values))[0].result;
    },fetcher:async(url,init)=>{
      assert.equal(init.redirect,'manual');
      if(String(url).includes('/models/user'))return Response.json({data:[{id:'vendor/model',context_length:100000,pricing:{prompt:'.000001',completion:'.00001'}}]});
      assert.equal(String(url),'https://openrouter.ai/api/v1/chat/completions','No Redis or extra services');
      fetches++;const payload=JSON.parse(init.body);assert.ok(payload.max_tokens<50000);assert.ok(payload.provider.max_price.completion>0);
      assert.equal((await query('select state from blue_proxy_calls where request_id=$1',[task]))[0].state,'dispatching','intent committed before fetch');
      return Response.json({choices:[{message:{content:'Synthetic completed'}}],usage:{cost:.003,prompt_tokens:10,completion_tokens:4}});
    }});
  assert.equal(response.status,200,await response.clone().text());await response.json();
  assert.deepEqual(calls,['admit_blue_proxy_call_v2','settle_blue_proxy_call']);assert.equal(fetches,1);
  const call=(await query('select * from blue_proxy_calls where request_id=$1',[task]))[0];
  assert.equal(call.state,'settled');assert.equal(Number(call.provider_cost),.003);assert.equal(call.redis_hold_required,false);
  await query("select finish_blue_proxy_task($1,$2,'completed')",[owner,task]);
  assert.equal(Number((await query('select blue_credits from wallets where user_id=$1',[owner]))[0].blue_credits),9.997);
});

test('migration seeds the current legacy rate window instead of granting another 120 requests',async()=>{
  const owner=await user(),task=await admit(owner);
  const c=await reserve(owner,task,0);await settle(c.id,0,true);
  await query('delete from blue_proxy_rate_windows where user_id=$1',[owner]);
  await db.exec(await migration('044_blue_atomic_proxy_admission.sql'));
  assert.equal((await query('select requests from blue_proxy_rate_windows where user_id=$1',[owner]))[0].requests,1);
});
