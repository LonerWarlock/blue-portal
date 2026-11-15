const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {randomUUID,createHash}=require('node:crypto');
const root=process.env.BLUE_PORTAL_TEST_ROOT||path.resolve(__dirname,'..');
const {PGlite}=require(path.join(root,'node_modules/@electric-sql/pglite'));
const migration=name=>fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8');
function fn(file,name){const match=migration(file).match(new RegExp('create or replace function public\\.'+name+'\\s*\\([\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$[^;]*;','i'));assert.ok(match,name);return match[0];}
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 alter default privileges grant execute on functions to anon,authenticated;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now());
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;`);
 for(const file of ['002_blue_pro.sql','004_payg_production.sql','005_custom_pack_access_tier.sql','007_zero_cost_reservations.sql',
 '010_blue_direct_runtime.sql','012_blue_runtime_delayed_usage_settlement.sql','013_expired_reservation_reconciliation.sql','015_blue_runtime_heartbeat.sql',
 '020_blue_runtime_global_queue.sql','024_blue_credit_clarity.sql','025_blue_runtime_approval_reviewer.sql','028_blue_runtime_free_approval_reviewer.sql'])
 await db.exec(migration(file).replace('create extension if not exists pgcrypto;',''));
 await db.exec(`create table checkout_sessions(id uuid primary key,user_id uuid not null references auth.users(id),plan text not null,billing_cycle text not null,status text not null default 'pending',expires_at timestamptz not null,completed_at timestamptz,metadata jsonb default '{}');
 create table subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid unique not null references auth.users(id),plan text,status text,current_period_start timestamptz,current_period_end timestamptz,stripe_subscription_id text,stripe_customer_id text,metadata jsonb,updated_at timestamptz);`);
 for(const file of ['026_blue_subscription_billing_cycles.sql','031_blue_teams_checkout.sql','032_blue_teams_live_business_launch_test.sql',
 '033_blue_teams_admin_grants.sql','034_blue_teams_plan_transitions.sql','035_desktop_activity_reporting.sql','036_blue_teams_credits_and_platform_fee.sql',
 '037_blue_runtime_replacement_free_reviewer.sql','039_blue_task_ticket_proxy.sql','040_restore_blue_usage_summary.sql','041_blue_runtime_control_limiter.sql',
 '043_blue_credit_fractional_purchase_precision.sql','044_blue_atomic_proxy_admission.sql','045_blue_organizations.sql']) await db.exec(migration(file));
 const owner=randomUUID(),member=randomUUID();await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[owner,'owner@example.test',member,'member@example.test']);
 const rpc=async(name,args)=>{const result=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args);return result.rows[0].value;};
 const org=await rpc('blue_organization_create',[owner,'Test Company']);
 async function pay(credits=50){const id=randomUUID();await db.query('insert into credit_payments(id,user_id,organization_id,credits_purchased,provider_txnid,amount_paid) values($1,$2,$3,$4,$5,$4::numeric*115)',[id,owner,org,credits,id]);return {id,receipt:await rpc('complete_blue_credit_payment',[id,id])};}
 const task=async(user=owner,amount=.2)=>{const id='test-'+randomUUID();await rpc('admit_blue_organization_task',[user,id,'a'.repeat(64),'b'.repeat(64),'vendor/model','normal',false,'full',amount,100,500,new Date(Date.now()+60000).toISOString(),new Date(Date.now()+3600000).toISOString(),null,'teams','text',org]);await db.query("update blue_runtime_tasks set state='active',proxy_models=array['vendor/model'] where request_id=$1",[id]);return id;};
 return {db,rpc,owner,member,org,pay,task,close:()=>db.close()};
}
test('Organization SQL: purchases, seats, revoke/accept, caps, reserved last funds, atomic call and idempotent settlement',async()=>{
 const f=await fixture();try{
 const payment=await f.pay();await f.rpc('complete_blue_credit_payment',[payment.id,payment.id]);
 let c=await f.rpc('blue_organization_context',[f.owner,f.org]);assert.equal(c.purchased,50);assert.equal(c.seat_limit,5);assert.equal(c.allowance,50,'No-limit members can use the shared balance');
 const hash=string=>createHash('sha256').update(string).digest('hex');
 const invitation=await f.rpc('blue_organization_invite',[f.owner,f.org,'member@example.test',hash('first')]);
 await f.rpc('blue_organization_revoke_invite',[f.owner,f.org,invitation]);await assert.rejects(f.rpc('blue_organization_accept',[f.member,hash('first')]),/Invitation unavailable/);
 await f.rpc('blue_organization_invite',[f.owner,f.org,'member@example.test',hash('second')]);await f.rpc('blue_organization_accept',[f.member,hash('second')]);
 await f.rpc('blue_organization_member_update',[f.owner,f.org,f.member,false,.3]);const id=await f.task(f.member,.2);assert.equal((await f.rpc('blue_organization_context',[f.member,f.org])).allowance,.1,'Caps subtract active task holds');
 const capTask='rejected-'+randomUUID();await f.rpc('admit_blue_organization_task',[f.member,capTask,'a'.repeat(64),'b'.repeat(64),'vendor/model','normal',false,'full',.2,100,500,new Date(Date.now()+60000).toISOString(),new Date(Date.now()+3600000).toISOString(),null,'teams','text',f.org]);
 assert.equal((await f.db.query('select state from blue_runtime_tasks where request_id=$1',[capTask])).rows[0].state,'failed');
 await assert.rejects(f.rpc('blue_organization_member_update',[f.owner,f.org,f.member,false,.1]),/already spent and reserved/);
 const call=randomUUID(),attempt=randomUUID(),args=[f.member,id,'a'.repeat(64),'vendor/model',call,'c'.repeat(64),attempt,{version:1,purpose:'text',fixed_cost:.01,output_rate:.001,output_limit:1000}];
 const admitted=await f.rpc('admit_blue_proxy_call_v2',args);assert.equal(admitted.accepted,true);assert.ok(admitted.output_limit<=190);
 assert.equal((await f.rpc('admit_blue_proxy_call_v2',args)).accepted,false);
 const row=(await f.db.query('select * from blue_proxy_calls where id=$1',[call])).rows[0];assert.equal(row.admission_version,2);assert.equal(row.redis_hold_required,false);
 await f.rpc('settle_blue_proxy_call',[call,.08,10,20,false]);
 await f.rpc('finish_blue_proxy_task',[f.member,id,'completed']);await f.rpc('finish_blue_proxy_task',[f.member,id,'completed']);
 c=await f.rpc('blue_organization_context',[f.member,f.org]);assert.equal(c.member_spent,.08);assert.equal(c.member_held,0);assert.equal(c.available,49.92);
 await f.rpc('blue_organization_member_update',[f.owner,f.org,f.member,true,null]);
 await f.rpc('blue_organization_invite',[f.owner,f.org,'member@example.test',hash('third')]);await f.rpc('blue_organization_accept',[f.member,hash('third')]);
 c=await f.rpc('blue_organization_context',[f.member,f.org]);assert.equal(c.member_spent,.08);assert.equal(c.spend_cap,.3);
 assert.equal((await f.db.query('select count(*) as n from wallets')).rows[0].n,0,'no personal wallets funded');
 await assert.rejects(f.db.exec('update blue_organization_events set credits=0'),/append only/);
 }finally{await f.close();}
});
test('Organization SQL: owner authorization, seat limit, revocation releases seat immediately, tenant isolation and removal blocks dispatch',async()=>{
 const f=await fixture();try{await f.pay();const hash=i=>createHash('sha256').update(String(i)).digest('hex');
 const invitations=[];for(let i=0;i<4;i++)invitations.push(await f.rpc('blue_organization_invite',[f.owner,f.org,`user${i}@example.test`,hash(i)]));
 await assert.rejects(f.rpc('blue_organization_invite',[f.owner,f.org,'extra@example.test',hash(5)]),/seat limit/);
 await f.rpc('blue_organization_revoke_invite',[f.owner,f.org,invitations[0]]);await f.rpc('blue_organization_invite',[f.owner,f.org,'member@example.test',hash('member')]);
 await assert.rejects(f.rpc('blue_organization_context',[f.member,f.org]),/access denied/);
 await f.rpc('blue_organization_accept',[f.member,hash('member')]);const id=await f.task(f.member,.2);
 await assert.rejects(f.rpc('blue_organization_revoke_invite',[f.member,f.org,invitations[1]]),/owner required/);
 await f.rpc('blue_organization_member_update',[f.owner,f.org,f.member,true,null]);
 await assert.rejects(f.rpc('admit_blue_proxy_call_v2',[f.member,id,'a'.repeat(64),'vendor/model',randomUUID(),'c'.repeat(64),randomUUID(),{version:1,purpose:'text',fixed_cost:0,output_rate:0,output_limit:10}]),/access denied/);
 await f.rpc('settle_blue_credit_reservation',[f.member,id,.05,1,0,0]);
 const m=(await f.db.query('select spent,held from blue_organization_members where organization_id=$1 and user_id=$2',[f.org,f.member])).rows[0];assert.equal(Number(m.spent),.05);assert.equal(Number(m.held),0);
 await f.db.exec('set role authenticated');await assert.rejects(f.db.query('select * from blue_organization_wallets'),/permission denied/);
 }finally{await f.close();}
});

test('Organization full migration: personal balances stay isolated, reapplying preserves ledger, last-held funds remain spendable, and account limit is enforced',async()=>{
 const f=await fixture();try{
 await f.pay();await f.db.query("insert into wallets(user_id,balance,account_type,blue_credits) values($1,0,'pro_payg',3)",[f.owner]);
 await f.db.query("insert into blue_profiles(user_id,status,access_tier,total_credits_purchased,total_credits_used,last_top_up_credits) values($1,'active','full',3,0,3)",[f.owner]);
 const id=await f.task(f.owner,50);
 const before=await f.rpc('blue_organization_context',[f.owner,f.org]);assert.equal(before.available,0);assert.equal(before.held,50);
 const call=randomUUID(),args=[f.owner,id,'a'.repeat(64),'vendor/model',call,'c'.repeat(64),randomUUID(),{version:1,purpose:'text',fixed_cost:0,output_rate:0,output_limit:100}];
 assert.equal((await f.rpc('admit_blue_proxy_call_v2',args)).accepted,true);
 const personal=await f.rpc('blue_credit_snapshot',[f.owner]);assert.equal(personal.available_blue_credits,3);assert.equal(personal.temporarily_held_blue_credits,0);
 await f.rpc('settle_blue_proxy_call',[call,0,0,0,false]);await f.rpc('finish_blue_proxy_task',[f.owner,id,'completed']);
 const events=(await f.db.query('select count(*) n from blue_organization_events')).rows[0].n;
 await f.db.exec(migration('045_blue_organizations.sql'));assert.equal((await f.db.query('select count(*) n from blue_organization_events')).rows[0].n,events);
 await f.rpc('reserve_blue_credits',[f.owner,'personal-request-001','vendor/model',.2]);
 await f.rpc('settle_blue_credit_reservation',[f.owner,'personal-request-001',.1,1,10,10]);
 assert.equal(Number((await f.db.query('select blue_credits from wallets where user_id=$1',[f.owner])).rows[0].blue_credits),2.9);
 assert.equal((await f.rpc('blue_organization_context',[f.owner,f.org])).available,50);
 const next=await f.task(f.owner,.2);await f.db.query("insert into blue_proxy_rate_windows(user_id,window_start,requests) values($1,date_trunc('minute',clock_timestamp()),120) on conflict(user_id) do update set window_start=excluded.window_start,requests=120",[f.owner]);
 await assert.rejects(f.rpc('admit_blue_proxy_call_v2',[f.owner,next,'a'.repeat(64),'vendor/model',randomUUID(),'d'.repeat(64),randomUUID(),args[7]]),/rate limit/);
 }finally{await f.close();}
});

test('Organization task extensions reserve once and completed zero-cost tasks refund the original shared pool',async()=>{
 const f=await fixture();try{await f.pay();const id=await f.task(),expiry=new Date(Date.now()+3600000).toISOString();
 await f.rpc('extend_blue_runtime_task_v2',[f.owner,id,'extension-organization-001',.2,expiry]);
 assert.equal((await f.rpc('extend_blue_runtime_task_v2',[f.owner,id,'extension-organization-001',.2,expiry])).duplicate,true);
 let c=await f.rpc('blue_organization_context',[f.owner,f.org]);assert.equal(c.available,49.6);assert.equal(c.member_held,.4);
 await f.rpc('finish_blue_proxy_task',[f.owner,id,'completed']);c=await f.rpc('blue_organization_context',[f.owner,f.org]);assert.equal(c.available,50);assert.equal(c.member_held,0);
 await assert.rejects(f.rpc('blue_organization_member_update',[f.owner,f.org,f.owner,true,null]),/Owner cannot remove/);
 }finally{await f.close();}
});
