import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import * as policy from './blueCreditPolicy.ts';
const load=async(file,modules={})=>{
  const text=await readFile(new URL(file,import.meta.url),'utf8');
  const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const result={};new Function('require','exports',code)(name=>{if(!(name in modules))throw new Error('Unexpectedmodule '+name);return modules[name];},result);return result;
};
const prices=await load('./exchangeRate.ts',{'@/lib/blueCreditPolicy':policy});
const receipts=await load('./blueTeamsCreditAccess.ts',{'./blueCreditPolicy':policy});
const migration=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
let db,legacyTeamOrder;
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    alter default privileges grant execute on functions to anon,authenticated;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
  for(const file of ['002_blue_pro.sql','004_payg_production.sql','005_custom_pack_access_tier.sql',
    '007_zero_cost_reservations.sql','010_blue_direct_runtime.sql','012_blue_runtime_delayed_usage_settlement.sql',
    '013_expired_reservation_reconciliation.sql','015_blue_runtime_heartbeat.sql','020_blue_runtime_global_queue.sql',
    '024_blue_credit_clarity.sql','025_blue_runtime_approval_reviewer.sql','028_blue_runtime_free_approval_reviewer.sql']){
    await db.exec((await migration(file)).replace('create extension if not exists pgcrypto;',''));
  }
  // Exercise the real subscription/Teams schema and prior transition functions,
  // including provenance/FK constraints, rather than a Teams table stub.
  await db.exec(`alter table auth.users add column email text;
    create table checkout_sessions(id uuid primary key,user_id uuid not null references auth.users(id),
      plan text not null,billing_cycle text not null,status text not null default 'pending',
      expires_at timestamptz not null,completed_at timestamptz,metadata jsonb default '{}');
    create table subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid unique not null references auth.users(id),
      plan text,status text,current_period_start timestamptz,current_period_end timestamptz,
      stripe_subscription_id text,stripe_customer_id text,metadata jsonb,updated_at timestamptz);`);
  for(const file of ['026_blue_subscription_billing_cycles.sql','031_blue_teams_checkout.sql',
    '032_blue_teams_live_business_launch_test.sql','033_blue_teams_admin_grants.sql','034_blue_teams_plan_transitions.sql','035_desktop_activity_reporting.sql']) await db.exec(await migration(file));
  // A pre-existing hold retains its old agreed rate after the migration.
  const u='00000000-0000-4000-8000-000000000001';
  await db.query('insert into auth.users values($1)',[u]);
  await db.query("insert into wallets(user_id,account_type,blue_credits) values($1,'pro_payg',10)",[u]);
  await db.query("insert into blue_profiles(user_id,status,total_credits_purchased,access_tier) values($1,'active',10,'full')",[u]);
  await db.query("select reserve_blue_credits($1,'old-rate-request','vendor/model',1)",[u]);
  await db.query(`insert into blue_runtime_tasks(request_id,user_id,device_hash,payload_hash,model,mode,is_free,access_tier,state,reserved_blue_credits,expires_at)
    values('old-queued-task',$1,'device','hash','vendor/model','normal',false,'full','queued',0,now()+interval '1 hour')`,[u]);
  const quote=(await db.query("select create_blue_teams_checkout($1,'solo',false,false) result",[u])).rows[0].result;
  legacyTeamOrder={session:quote.session_id,providerOrder:'old-team-provider-order'};
  await db.query(`insert into payment_orders(id,checkout_session_id,user_id,product_sku,amount,currency,gateway,provider_order_id,custom_id,expires_at)
    values($1,$2,$3,'blue_teams_solo_monthly',499,'INR','payu',$4,$4,now()+interval '15 minutes')`,[randomUUID(),quote.session_id,u,legacyTeamOrder.providerOrder]);
  await db.exec(await migration('036_blue_teams_credits_and_platform_fee.sql'));
  await db.exec(await migration('036_blue_teams_credits_and_platform_fee.sql'));
});
after(async()=>{await db?.close();});
async function user(){const id=randomUUID();await db.query('insert into auth.users values($1)',[id]);return id;}
async function payment(u,credits,status='pending'){
  const id=randomUUID(),tx='credit-'+randomUUID();
  await db.query(`insert into credit_payments(id,user_id,amount_paid,currency,credits_purchased,payment_provider,provider_txnid,status,pack_id)
    values($1,$2,$3,'USD',$4,'paypal',$5,$6,'custom')`,[id,u,credits*1.3,credits,tx,status]);
  return{id,tx};
}
async function complete(p){return(await db.query('select complete_blue_credit_payment($1,$2) result',[p.id,p.tx])).rows[0].result;}
async function buy(u,credits){const p=await payment(u,credits);await complete(p);return p;}
async function entitlement(u){return(await db.query('select blue_teams_credit_entitlement($1) result',[u])).rows[0].result;}
async function reserve(u,amount){const id='hold-'+randomUUID();await db.query('select reserve_blue_credits($1,$2,$3,$4)',[u,id,'vendor/model',amount]);return id;}
async function settle(u,id,cost,multiplier=99){return(await db.query('select settle_blue_credit_reservation($1,$2,$3,$4,0,0) result',[u,id,cost,multiplier])).rows[0].result;}
async function admit(u,feature='teams',id='task-'+randomUUID()){
  const args=[u,id,'a'.repeat(64),'b'.repeat(64),'vendor/model','normal',false,'full',0.2,100,500,
    new Date(Date.now()+120000).toISOString(),new Date(Date.now()+3600000).toISOString(),null,feature];
  return(await db.query('select admit_blue_runtime_task_v4('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result;
}
test('25 credits cost $25 plus $7.50 platform fee, with no usage markup or stale env override',()=>{
  assert.equal(policy.configuredBlueCreditMultiplier('1.5'),1);
  assert.equal(policy.configuredBlueCreditMultiplier(100),1);
  const pack=prices.getCustomPackConfig(25);
  assert.equal(pack.credits,25);assert.equal(pack.basePriceUSD,25);assert.equal(pack.platformFeeUSD,7.5);assert.equal(pack.priceUSD,32.5);
  assert.equal(pack.basePriceINR,2500);assert.equal(pack.platformFeeINR,750);assert.equal(pack.priceINR,3250);assert.equal(pack.multiplier,1);
  assert.equal(prices.getPackConfig('starter').priceUSD,1.3);assert.equal(prices.getPackConfig('standard').priceUSD,19.5);
  for(const bad of [NaN,Infinity,-1,9,25.5,101,'25'])assert.throws(()=>prices.getCustomPackConfig(bad));
});
test('a single settled purchase of at least25 activates; unpaid and cumulative smaller purchases do not',async()=>{
  const u=await user();await payment(u,25);assert.equal((await entitlement(u)).status,'inactive');
  await buy(u,15);await buy(u,10);assert.equal((await entitlement(u)).status,'inactive');
  await buy(u,25);const e=await entitlement(u);assert.equal(e.plan,'payg');assert.equal(e.access_source,'credits');assert.equal(e.total_blue_credits,50);
  assert.equal(e.active_project_teams,10);assert.equal(e.agents_per_team,8);
});
test('topups accumulate; settlement atzero revokes and subthreshold topup/replayedpurchase cannot restore',async()=>{
  const u=await user(),first=await buy(u,25);
  await settle(u,await reserve(u,10),10);assert.equal((await entitlement(u)).total_blue_credits,15);
  await buy(u,10);assert.equal((await entitlement(u)).total_blue_credits,25);
  await settle(u,await reserve(u,25),25);assert.equal((await entitlement(u)).status,'inactive');
  await buy(u,10);assert.equal((await entitlement(u)).status,'inactive');
  assert.equal((await complete(first)).already_processed,true);assert.equal((await entitlement(u)).status,'inactive');
  await buy(u,25);assert.equal((await entitlement(u)).total_blue_credits,35);assert.equal((await entitlement(u)).status,'active');
});
test('pending holds are not depletion; released credits retain their activation',async()=>{
  const u=await user();await buy(u,25);const hold=await reserve(u,25);
  let e=await entitlement(u);assert.equal(e.available_blue_credits,0);assert.equal(e.total_blue_credits,25);assert.equal(e.status,'active');
  await db.query('select release_blue_credit_reservation($1,$2)',[u,hold]);
  e=await entitlement(u);assert.equal(e.available_blue_credits,25);assert.equal(e.status,'active');
});
test('one-for-one cost settlement is atomic/idempotent and retains formerholdrate',async()=>{
  const u=await user();await buy(u,25);const id=await reserve(u,1),result=await settle(u,id,0.25,999);
  assert.equal(result.charged,0.25);assert.equal(result.remaining,24.75);
  assert.deepEqual(await settle(u,id,9,999),result);
  const old=await settle('00000000-0000-4000-8000-000000000001','old-rate-request',0.2,1);
  assert.equal(old.charged,0.3);
});
test('refund invalidates its activation and ordinary administrative credits cannot fake a paid purchase',async()=>{
  const u=await user(),p=await buy(u,25);
  await db.query("update credit_payments set status='failed' where id=$1",[p.id]);
  assert.equal((await entitlement(u)).status,'inactive');
  await db.query('select add_blue_credits($1,25)',[u]);assert.equal((await entitlement(u)).status,'inactive');
});
test('existing paid legacyaccess is honoured onlyuntilitsoriginalexpiry',async()=>{
  const u=await user(),session=randomUUID(),order=randomUUID();
  await db.query("insert into checkout_sessions(id,user_id,plan,billing_cycle,expires_at) values($1,$2,'blue_teams_pro','monthly',now()+interval '1 day')",[session,u]);
  await db.query("insert into payment_orders(id,checkout_session_id,user_id,product_sku,amount,currency,gateway,expires_at) values($1,$2,$3,'blue_teams_pro_monthly',1499,'INR','payu',now()+interval '1 day')",[order,session,u]);
  await db.query("insert into team_subscriptions(user_id,plan,status,is_test,current_period_start,current_period_end,payment_provider,payment_order_id) values($1,'pro','active',false,now(),now()+interval '1 day','payu',$2)",[u,order]);
  let e=await entitlement(u);assert.equal(e.status,'active');assert.equal(e.access_source,'legacy_subscription');
  await db.query("update team_subscriptions set current_period_end=now()-interval '1 second' where user_id=$1",[u]);
  assert.equal((await entitlement(u)).status,'inactive');
});
test('Teamruntime admission checks entitlement and immutablefeature; ordinaryprojects are independent',async()=>{
  const u=await user();await buy(u,15);
  await assert.rejects(admit(u),/at least 25/);
  assert.equal((await entitlement(u)).available_blue_credits,15,'rejected admission rolls its tentative hold back');
  const p=await admit(u,'project');assert.equal(p.conflict,false);
  await buy(u,25);const id='task-'+randomUUID();await admit(u,'teams',id);
  const task=(await db.query('select feature,credit_multiplier from blue_runtime_tasks where request_id=$1',[id])).rows[0];
  assert.equal(task.feature,'teams');assert.equal(Number(task.credit_multiplier),1);
  assert.equal((await admit(u,'project',id)).conflict,true);
});
test('Teams access and activation state are service-only even underSupabase default grants',async()=>{
  for(const role of ['anon','authenticated']){
    const result=await db.query("select has_table_privilege($1,'public.blue_teams_credit_access','SELECT') allowed,has_function_privilege($1,'public.blue_teams_credit_entitlement(uuid)','EXECUTE') execute",[role]);
    assert.equal(result.rows[0].allowed,false);assert.equal(result.rows[0].execute,false);
  }
});
test('native account loader rejects accountswaps/malformedcredits; unavailable isnot an activegrant',async()=>{
  const u=await user();await buy(u,25);const e=await entitlement(u);
  const load=row=>receipts.loadBlueTeamsCreditEntitlement({rpc:async()=>({data:row})},u);
  assert.equal((await load(e)).status,'active');assert.equal((await load({...e,user_id:randomUUID()})).available,false);
  assert.equal((await load({...e,total_blue_credits:-1})).available,false);
  assert.equal((await load({...e,plan:'payg',access_source:'credits',total_blue_credits:0,available_blue_credits:0})).status,'inactive');
});
test('new Teams subscription quotes and scheduledrenewals are retired',async()=>{
  const u=await user();await assert.rejects(db.query("select create_blue_teams_checkout($1,'business',false,false)",[u]),/replaced by Blue Credits/);
  await assert.rejects(db.query("select schedule_blue_teams_change($1,'pro')",[u]),/replaced by Blue Credits/);
});

test('a task queued before migration retains its previousrate when first reserved afterwards',async()=>{
  const u='00000000-0000-4000-8000-000000000001';
  await db.query("select reserve_blue_credits($1,'old-queued-task','vendor/model',1)",[u]);
  const res=(await db.query("select credit_multiplier from billing_reservations where request_id='old-queued-task'")).rows[0];
  assert.equal(Number(res.credit_multiplier),1.5);
  assert.equal((await settle(u,'old-queued-task',0.2)).charged,0.3);
});
test('an applied extension can replay afterrevocation; a newextension cannot debit or receive access',async()=>{
  const u=await user(),p=await buy(u,25),id='task-'+randomUUID();await admit(u,'teams',id);
  const extend=ext=>db.query('select extend_blue_runtime_task_v2($1,$2,$3,0.2,$4) result',[u,id,ext,new Date(Date.now()+3600000).toISOString()]);
  const first=(await extend('extension-0001')).rows[0].result;assert.equal(first.extended,true);
  await db.query("update credit_payments set status='failed' where id=$1",[p.id]);
  const duplicate=(await extend('extension-0001')).rows[0].result;assert.equal(duplicate.duplicate,true);assert.equal(duplicate.remaining,first.remaining);
  await assert.rejects(extend('extension-0002'),/at least 25/);
  const balance=(await db.query('select blue_credits from wallets where user_id=$1',[u])).rows[0];assert.equal(Number(balance.blue_credits),first.remaining);
});

test('alreadycollected legacy Teams orders stillsettle after subscriptions are retired',async()=>{
  const args=[legacyTeamOrder.session,'payu',legacyTeamOrder.providerOrder,'old-team-transaction','old-buyer@test.invalid'];
  const receipt=(await db.query('select complete_blue_teams_checkout($1,$2,$3,$4,$5) result',args)).rows[0].result;
  assert.equal(receipt.outcome,'completed');
  const replay=(await db.query('select complete_blue_teams_checkout($1,$2,$3,$4,$5) result',args)).rows[0].result;
  assert.equal(replay.already_processed,true);
});

test('new Teamgates preserve reservation-before-wallet lock order and atomicrejection',async()=>{
  const sql=await migration('036_blue_teams_credits_and_platform_fee.sql');
  const extension=sql.slice(sql.indexOf('create or replace function public.extend_blue_runtime_task_v2('),sql.indexOf('-- Retire the database quote'));
  const reservation=extension.indexOf('perform 1 from public.billing_reservations');
  const wallet=extension.indexOf('public.blue_teams_credit_entitlement');
  assert.ok(reservation>0&&wallet>reservation,'extension must obtain its reservation before entitlement locks wallet');
  const admission=sql.slice(sql.indexOf('create or replace function public.admit_blue_runtime_task_v4('),sql.indexOf('create or replace function public.extend_blue_runtime_task_v2('));
  assert.ok(admission.indexOf('receipt:=public.admit_blue_runtime_task_v2')<admission.indexOf('access:=public.blue_teams_credit_entitlement'),
    'do not lock a wallet before native queue/reservation admission');
});


test('legacy billing helpers cannot bypass server-only authority under explicit Supabase default grants',async()=>{
  const signatures=["reserve_blue_credits(uuid,text,text,numeric)","release_blue_credit_reservation(uuid,text)","release_expired_blue_credit_reservations(uuid)","increment_blue_credits_purchased(uuid,numeric)","increment_blue_credits_used(uuid,numeric)","admit_blue_runtime_task(uuid,text,text,text,text,text,boolean,text,numeric,integer,timestamptz)","admit_blue_runtime_task_v2(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz)","admit_blue_runtime_task_v3(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text)","extend_blue_runtime_task(uuid,text,text,numeric,timestamptz)","rollback_blue_runtime_extension(uuid,text,text,numeric)","cancel_blue_gateway_request(uuid,text)","promote_blue_runtime_queue(integer,integer,timestamptz)"];
  for(const role of ['anon','authenticated'])for(const signature of signatures){
    const result=await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,'public.'+signature]);
    assert.equal(result.rows[0].allowed,false,role+' cannot execute '+signature);
  }
});
