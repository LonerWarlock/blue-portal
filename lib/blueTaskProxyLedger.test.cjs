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
    '036_blue_teams_credits_and_platform_fee.sql','037_blue_runtime_replacement_free_reviewer.sql','039_blue_task_ticket_proxy.sql']) await db.exec(await migration(file));
});
test.after(async () => { await db?.close(); });
test('migration can be safely reapplied without losing existing ledger data', async () => {
  const owner = await user(), task = await admit(owner);
  const before = await query('select * from blue_credit_events where request_id=$1', [task]);
  assert.equal(before.length, 1);
  await db.exec(await migration('039_blue_task_ticket_proxy.sql'));
  assert.deepEqual(await query('select * from blue_credit_events where request_id=$1', [task]), before);
});
test('dashboard summary repair exposes the aggregate only to the service role', async () => {
  await db.exec(await migration('040_restore_blue_usage_summary.sql'));
  await db.exec(await migration('040_restore_blue_usage_summary.sql'));
  const owner=await user();
  const data=(await query("select blue_usage_summary($1,now()-interval '30 days') summary",[owner]))[0].summary;
  assert.equal(Number(data.total_requests),0); assert.equal(Number(data.total_blue_credits_used),0);
  const task=await admit(owner), call=await reserve(owner,task);
  await query('select dispatch_blue_proxy_call($1)',[call.id]); await settle(call.id,.02);
  await query("select finish_blue_proxy_task($1,$2,'completed')",[owner,task]);
  const total=(await query("select blue_usage_summary($1,now()-interval '30 days') summary",[owner]))[0].summary;
  assert.equal(Number(total.total_requests),1); assert.equal(Number(total.total_blue_credits_used),.02);
  assert.equal(total.model_breakdown['vendor/model'].requests,1);
  const grants=await query("select has_function_privilege('authenticated','blue_usage_summary(uuid,timestamptz)','execute') allowed");
  assert.equal(grants[0].allowed,false);
});
test('applying the migration before Portal deploy preserves old-backend tasks as legacy', async () => {
  const owner = await user(), id = 'legacy-' + randomUUID();
  const args = [owner,id,'a'.repeat(64),'b'.repeat(64),'vendor/model','normal',false,'full',.2,
    100,500,new Date(Date.now()+120000).toISOString(),new Date(Date.now()+3600000).toISOString(),null,'project'];
  await query('select admit_blue_runtime_task_v4(' + args.map((_,i) => '$'+(i+1)).join(',') + ')', args);
  assert.equal((await query('select runtime_transport from blue_runtime_tasks where request_id=$1', [id]))[0].runtime_transport, 'legacy');
  await assert.rejects(query('select activate_blue_proxy_task($1,$2,$3)', [owner,id,['vendor/model']]), /not active/);
  const balance = (await query('select blue_credits from wallets where user_id=$1', [owner]))[0].blue_credits;
  const newArgs = [...args, 'text'];
  await assert.rejects(query('select admit_blue_runtime_task_v5(' + newArgs.map((_,i) => '$'+(i+1)).join(',') + ')', newArgs), /Legacy task/);
  assert.equal((await query('select blue_credits from wallets where user_id=$1', [owner]))[0].blue_credits, balance);
  const fresh = await admit(owner);
  assert.equal((await query('select runtime_transport from blue_runtime_tasks where request_id=$1', [fresh]))[0].runtime_transport, 'ticket');
});
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

test('parallel specialists cannot overdraw one task; task reservations cannot overdraw the same wallet', async () => {
  const owner = await user(), task = await admit(owner);
  const results = await Promise.allSettled([reserve(owner,task,.15),reserve(owner,task,.15)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message,/allowance exhausted/);
  assert.equal(Number((await query('select blue_credits from wallets where user_id=$1',[owner]))[0].blue_credits),9.8);
  const second = await admit(owner);
  assert.notEqual(task,second);
  assert.equal(Number((await query('select blue_credits from wallets where user_id=$1',[owner]))[0].blue_credits),9.6);
});

test('a duplicated call ID is never dispatched twice and a repeated settlement cannot charge twice', async () => {
  const owner=await user(), task=await admit(owner), call=await reserve(owner,task);
  assert.equal((await reserve(owner,task,.1,call.id)).accepted,false);
  assert.equal((await query('select dispatch_blue_proxy_call($1) result',[call.id]))[0].result,true);
  assert.equal((await query('select dispatch_blue_proxy_call($1) result',[call.id]))[0].result,false);
  await settle(call.id,.02); await settle(call.id,.02);
  assert.equal(Number((await query('select provider_cost from blue_runtime_tasks where request_id=$1',[task]))[0].provider_cost),.02);
});

test('finishing waits for pending calls, blocks new calls, then charges actual cost and refunds the remainder', async () => {
  const owner=await user(), task=await admit(owner), call=await reserve(owner,task);
  await query('select dispatch_blue_proxy_call($1)',[call.id]);
  assert.equal((await query("select finish_blue_proxy_task($1,$2,'completed') result",[owner,task]))[0].result.pending,true);
  await assert.rejects(reserve(owner,task),/access denied/);
  await settle(call.id,.03);
  await query("select finish_blue_proxy_task($1,$2,'failed')",[owner,task]);
  await query("select finish_blue_proxy_task($1,$2,'completed')",[owner,task]);
  const row=(await query('select * from blue_runtime_tasks where request_id=$1',[task]))[0];
  assert.equal(row.state,'completed'); assert.equal(Number(row.charged_blue_credits),.03);
  assert.equal(Number((await query('select blue_credits from wallets where user_id=$1',[owner]))[0].blue_credits),9.97);
  const ledger=await query("select kind,count(*) n from blue_credit_events where request_id=$1 group by kind",[task]);
  assert.equal(Number(ledger.find(x=>x.kind==='wallet_charge').n),1);
  assert.equal(Number(ledger.find(x=>x.kind==='wallet_refund').n),1);
});

test('wrong user, device and model bindings fail even with the privileged database role', async () => {
  const owner=await user(), other=await user(), task=await admit(owner);
  for(const args of [[other,task,'a'.repeat(64),'vendor/model'],[owner,task,'b'.repeat(64),'vendor/model'],[owner,task,'a'.repeat(64),'vendor/other']])
    await assert.rejects(query('select authorize_blue_proxy_task($1,$2,$3,$4)',args),/access denied/);
});

test('unknown provider usage stays held; server-observed generations are unique across calls', async () => {
  const owner=await user(), task=await admit(owner), one=await reserve(owner,task,.08),two=await reserve(owner,task,.08);
  await query('select dispatch_blue_proxy_call($1)',[one.id]); await query('select dispatch_blue_proxy_call($1)',[two.id]);
  await query('select observe_blue_proxy_generation($1,$2)',[one.id,'gen-ledger-unique']);
  await assert.rejects(query('select observe_blue_proxy_generation($1,$2)',[two.id,'gen-ledger-unique']),/unique/);
  assert.equal((await query("select finish_blue_proxy_task($1,$2,'stopped') result",[owner,task]))[0].result.pending,true);
});

test('recorded provider overruns never debit the user beyond their prepaid task hold', async () => {
  const owner=await user(), task=await admit(owner), call=await reserve(owner,task);
  await query('select dispatch_blue_proxy_call($1)',[call.id]); await settle(call.id,1.4);
  await query("select finish_blue_proxy_task($1,$2,'completed')",[owner,task]);
  const row=(await query('select * from blue_runtime_tasks where request_id=$1',[task]))[0];
  assert.equal(Number(row.provider_cost),1.4); assert.equal(Number(row.charged_blue_credits),.2);
  assert.equal(Number((await query('select blue_credits from wallets where user_id=$1',[owner]))[0].blue_credits),9.8);
  await query("delete from blue_runtime_model_blocks where model='vendor/model'");
});

test('free tasks cannot reserve paid inference; public roles cannot access proxy RPCs or mutate ledger events', async () => {
  const owner=await user(), task=await admit(owner,'project',true);
  await assert.rejects(reserve(owner,task,.01),/allowance exhausted/);
  await assert.rejects(query("update blue_credit_events set kind='forged' where user_id=$1",[owner]),/append only/);
  const rows=await query(`select has_function_privilege('authenticated','reserve_blue_proxy_call(uuid,text,text,text,uuid,text,numeric)','execute') allowed`);
  assert.equal(rows[0].allowed,false);
});

test('Teams retain purchase entitlements while using the same proxy and permanent ledger', async () => {
  const owner=await user();
  await assert.rejects(admit(owner,'teams'),/25 Blue Credits/);
  const payment=randomUUID(), tx='test-'+randomUUID();
  await query(`insert into credit_payments(id,user_id,amount_paid,currency,credits_purchased,payment_provider,provider_txnid,status,pack_id)
    values($1,$2,32.5,'USD',25,'paypal',$3,'pending','custom')`,[payment,owner,tx]);
  await query('select complete_blue_credit_payment($1,$2)',[payment,tx]);
  const task=await admit(owner,'teams'),call=await reserve(owner,task,.1);
  await query('select dispatch_blue_proxy_call($1)',[call.id]); await settle(call.id,.01);
  await query("select finish_blue_proxy_task($1,$2,'completed')",[owner,task]);
  const row=(await query('select feature,runtime_transport,charged_blue_credits from blue_runtime_tasks where request_id=$1',[task]))[0];
  assert.equal(row.feature,'teams'); assert.equal(row.runtime_transport,'ticket'); assert.equal(Number(row.charged_blue_credits),.01);
});
