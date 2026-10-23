import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

let db;
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create table checkout_sessions(id uuid primary key,user_id uuid not null references auth.users(id),
      plan text not null,billing_cycle text not null,status text not null default 'pending',
      expires_at timestamptz not null,completed_at timestamptz,metadata jsonb default '{}');
    create table subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid unique not null references auth.users(id),
      plan text,status text,current_period_start timestamptz,current_period_end timestamptz,
      stripe_subscription_id text,stripe_customer_id text,metadata jsonb,updated_at timestamptz);
    create table wallets(user_id uuid primary key references auth.users(id),balance numeric not null default 0,updated_at timestamptz);`);
  for (const file of ['026_blue_subscription_billing_cycles.sql','031_blue_teams_checkout.sql',
    '032_blue_teams_live_business_launch_test.sql','033_blue_teams_admin_grants.sql','034_blue_teams_plan_transitions.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  }
  await db.exec(await readFile(new URL('../supabase/migrations/034_blue_teams_plan_transitions.sql',import.meta.url),'utf8'));
});
after(async () => { await db?.close(); });

async function account() {
  const user = randomUUID();
  await db.query('insert into auth.users values($1,$2)',[user,`${user}@test.invalid`]);
  await db.query('insert into wallets(user_id,balance) values($1,100)',[user]);
  return user;
}
async function quote(user,tier='solo',sandbox=false,live=false) {
  return (await db.query('select public.create_blue_teams_checkout($1,$2,$3,$4) result',[user,tier,sandbox,live])).rows[0].result;
}
async function preflight(session,currency='INR') {
  return (await db.query('select public.validate_blue_teams_checkout($1,$2) result',[session,currency])).rows[0].result;
}
async function row(user,sandbox=false) {
  return (await db.query('select * from team_subscriptions where user_id=$1 and is_test=$2',[user,sandbox])).rows[0];
}
async function order(user,q,{currency='INR',amount,imr=0}={}) {
  const id=randomUUID(),providerOrder=randomUUID(),transaction=randomUUID(),provider=currency==='INR'?'payu':'paypal';
  const session=(await db.query('select * from checkout_sessions where id=$1',[q.session_id])).rows[0];
  await db.query(`insert into payment_orders(id,checkout_session_id,user_id,product_sku,amount,currency,redeemed_imr,
    gateway,provider_order_id,custom_id,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,now()+interval '15 minutes')`,
    [id,q.session_id,user,`${session.plan}_monthly`,amount??(currency==='INR'?q.base_amount_inr:q.base_amount_usd),currency,imr,provider,providerOrder]);
  return {id,session:q.session_id,provider,providerOrder,transaction};
}
async function settle(p) {
  return (await db.query('select public.complete_blue_teams_checkout($1,$2,$3,$4,$5) result',
    [p.session,p.provider,p.providerOrder,p.transaction,'payer@test.invalid'])).rows[0].result;
}
async function buy(user,tier='solo',options={}) {
  const q=await quote(user,tier,options.sandbox??false,options.live??false),p=await order(user,q,options);
  await settle(p); return {q,p};
}
async function halfPeriod(user) {
  await db.query("update team_subscriptions set current_period_start=now()-interval '15 days',current_period_end=now()+interval '15 days' where user_id=$1",[user]);
}

test('new and same-tier renewal are 30 prepaid days, and quote retries reuse one session',async()=>{
  const user=await account(),q=await quote(user);
  assert.equal(q.quote_mode,'new'); assert.equal(q.base_amount_inr,'499.00');assert.equal(q.base_amount_usd,'5.27');
  assert.equal(q.currency_locked,null);assert.equal((await quote(user)).session_id,q.session_id);
  const p=await order(user,q);await settle(p);const beforeRow=await row(user);
  const renewal=await quote(user);assert.equal(renewal.quote_mode,'renewal');
  await settle(await order(user,renewal));const afterRow=await row(user);
  assert.equal(+new Date(afterRow.current_period_end)-new Date(beforeRow.current_period_end),30*86400000);
  assert.equal(afterRow.plan,'solo');
});

test('a paid Solo to Pro upgrade charges the remaining-period difference and does not add 30 higher-tier days',async()=>{
  const user=await account();await buy(user);await halfPeriod(user);const beforeRow=await row(user);
  const q=await quote(user,'pro');assert.equal(q.quote_mode,'upgrade');assert.equal(q.from_plan,'solo');
  assert.equal(q.base_amount_inr,'500.00');assert.equal(q.currency_locked,'INR');
  await assert.rejects(preflight(q.session_id,'USD'),/currency of the existing paid plan/);
  assert.equal((await preflight(q.session_id)).base_amount_inr,'500.00');
  const p=await order(user,q);assert.equal((await settle(p)).outcome,'completed');
  const afterRow=await row(user);assert.equal(afterRow.plan,'pro');
  assert.equal(+new Date(afterRow.current_period_end),+new Date(beforeRow.current_period_end));
  assert.equal(afterRow.metadata.active_project_teams,3);assert.equal(afterRow.metadata.agents_per_team,5);
  assert.equal((await settle(p)).already_processed,true);
});

test('PayPal upgrades credit actual collected USD only and remain USD-locked',async()=>{
  const user=await account();await buy(user,'solo',{currency:'USD'});await halfPeriod(user);
  const q=await quote(user,'pro');assert.equal(q.currency_locked,'USD');assert.equal(q.base_amount_usd,'5.28');
  await assert.rejects(preflight(q.session_id,'INR'),/currency/);
  const p=await order(user,q,{currency:'USD'});assert.equal((await settle(p)).outcome,'completed');
});

test('discounted source payments receive only actual paid credit, not nominal catalogue credit',async()=>{
  const user=await account(),q=await quote(user);const p=await order(user,q,{imr:100,amount:'449.00'});await settle(p);
  await halfPeriod(user);const upgrade=await quote(user,'pro');assert.equal(upgrade.base_amount_inr,'525.00');
});

test('database settlement rejects IMR on prorated upgrades even if a malformed trusted order bypasses route validation',async()=>{
  const user=await account();await buy(user);await halfPeriod(user);const beforeRow=await row(user);
  const q=await quote(user,'pro');assert.equal(q.base_amount_inr,'500.00');
  const p=await order(user,q,{imr:100,amount:'450.00'});
  const beforeWallet=(await db.query('select balance from wallets where user_id=$1',[user])).rows[0].balance;
  await assert.rejects(settle(p),/IMR credits cannot be used for a prorated Teams upgrade/);
  assert.deepEqual(await row(user),beforeRow);
  assert.equal((await db.query('select balance from wallets where user_id=$1',[user])).rows[0].balance,beforeWallet);
  assert.equal((await db.query('select status from payment_orders where id=$1',[p.id])).rows[0].status,'pending');
});

test('complimentary Pro has zero paid credit and a normal remaining-period target price',async()=>{
  const user=await account(),email=`${user}@test.invalid`;
  await db.query('select public.grant_blue_teams_pro($1,$2,$3)',[email,randomUUID(),'Synthetic complimentary grant']);
  await halfPeriod(user);const q=await quote(user,'business');
  assert.equal(q.base_amount_inr,'2499.50');assert.equal(q.currency_locked,null);
  const p=await order(user,q);await settle(p);assert.equal((await row(user)).plan,'business');
});

test('downgrades schedule without payment or lost active features; cancel removes only the preference',async()=>{
  const user=await account();await buy(user,'business');const beforeRow=await row(user);
  await assert.rejects(quote(user,'solo'),/Schedule the change instead/);
  const scheduled=(await db.query('select public.schedule_blue_teams_change($1,$2) result',[user,'solo'])).rows[0].result;
  assert.equal(scheduled.payment_required,true);assert.equal(scheduled.pending_plan,'solo');
  const saved=await row(user);assert.equal(saved.plan,'business');assert.equal(saved.metadata.agents_per_team,8);
  assert.equal(+new Date(saved.current_period_end),+new Date(beforeRow.current_period_end));
  assert.equal(saved.metadata.scheduled_change.plan,'solo');
  assert.equal((await db.query('select count(*)::integer n from payment_orders where user_id=$1',[user])).rows[0].n,1);
  await db.query('select public.cancel_blue_teams_change($1)',[user]);
  assert.equal((await row(user)).metadata.scheduled_change,undefined);assert.equal((await row(user)).plan,'business');
});

test('an unpaid scheduled downgrade never auto-activates after expiry',async()=>{
  const user=await account();await buy(user,'pro');await db.query('select public.schedule_blue_teams_change($1,$2)',[user,'solo']);
  await db.query("update team_subscriptions set current_period_end=now()-interval '1 second' where user_id=$1",[user]);
  const q=await quote(user,'solo');assert.equal(q.quote_mode,'new');assert.equal(q.base_amount_inr,'499.00');
  assert.equal((await row(user)).plan,'pro','scheduled preference is not an entitlement');
  await settle(await order(user,q));assert.equal((await row(user)).plan,'solo');
});

test('a renewal retains a requested lower-plan preference and moves its payment date to the preserved expiry',async()=>{
  const user=await account();await buy(user,'business');await db.query('select public.schedule_blue_teams_change($1,$2)',[user,'solo']);
  await db.query("update team_subscriptions set metadata=metadata || '{\"unrelated_note\":\"keep\"}' where user_id=$1",[user]);
  await buy(user,'business');const updated=await row(user);
  assert.equal(updated.metadata.scheduled_change.plan,'solo');assert.equal(updated.metadata.unrelated_note,'keep');
  assert.equal(+new Date(updated.metadata.scheduled_change.change_at),+new Date(updated.current_period_end));
});

test('concurrent intents reuse the same tier and reject other viable or unresolved payable sessions',async()=>{
  const user=await account();const [a,b]=await Promise.all([quote(user),quote(user)]);assert.equal(a.session_id,b.session_id);
  await assert.rejects(quote(user,'pro'),/previous Teams checkout is still pending/);
  const p=await order(user,a);await db.query("update checkout_sessions set expires_at=now()-interval '1 second' where id=$1",[a.session_id]);
  await assert.rejects(quote(user,'pro'),/previous Teams checkout is still pending/);
  assert.equal((await settle(p)).outcome,'completed','late verified paid receipts are still reconciled');
});

test('unused expired checkout without a provider order can be replaced safely',async()=>{
  const user=await account(),a=await quote(user);
  await db.query("update checkout_sessions set expires_at=now()-interval '1 second' where id=$1",[a.session_id]);
  const b=await quote(user,'pro');assert.notEqual(a.session_id,b.session_id);
});

test('unverifiable source payments, stacked time and a second prorated upgrade stop before charging',async()=>{
  const stacked=await account();await buy(stacked);await buy(stacked);
  await assert.rejects(quote(stacked,'pro'),/more than 30 prepaid days/);
  const unknown=await account();await buy(unknown);
  await db.query("update payment_orders set product_sku='blue_teams_business_monthly' where id=(select payment_order_id from team_subscriptions where user_id=$1)",[unknown]);
  await assert.rejects(quote(unknown,'pro'),/prepaid value could not be verified/);
  const twice=await account();await buy(twice);await halfPeriod(twice);await buy(twice,'pro');
  await assert.rejects(quote(twice,'business'),/already has a prorated upgrade/);
});

test('stale upgrade preflight refuses a changed account before any charge',async()=>{
  const user=await account();await buy(user);await halfPeriod(user);const q=await quote(user,'pro');
  await db.query("update team_subscriptions set current_period_end=current_period_end+interval '1 day' where user_id=$1",[user]);
  await assert.rejects(preflight(q.session_id),/Teams access changed/);
});

test('a verified paid stale quote records one review receipt and never downgrades or extends another entitlement',async()=>{
  const user=await account();await buy(user);await halfPeriod(user);const q=await quote(user,'pro'),p=await order(user,q);
  await db.query("update team_subscriptions set plan='business',metadata=metadata || '{\"active_project_teams\":10,\"agents_per_team\":8}' where user_id=$1",[user]);
  const beforeRow=await row(user),result=await settle(p);assert.equal(result.outcome,'requires_review');
  const afterRow=await row(user);assert.equal(afterRow.plan,'business');assert.equal(+new Date(afterRow.current_period_end),+new Date(beforeRow.current_period_end));
  assert.equal((await settle(p)).outcome,'requires_review');
  assert.equal((await db.query('select count(*)::integer n from blue_teams_payment_reviews where user_id=$1',[user])).rows[0].n,1);
  assert.equal((await db.query('select status from payment_orders where id=$1',[p.id])).rows[0].status,'completed');
  await assert.rejects(quote(user,'business'),/Do not pay again/);
});

test('an existing unchanged quote cannot invite another payment after a separate collected receipt enters review',async()=>{
  const user=await account();await buy(user,'business');const q=await quote(user,'business');
  assert.equal((await preflight(q.session_id)).quote_mode,'renewal');
  const legacySession=randomUUID();
  await db.query(`insert into checkout_sessions(id,user_id,plan,billing_cycle,status,expires_at,metadata)
    values($1,$2,'blue_teams_solo','monthly','pending',now()-interval '1 minute','{}')`,[legacySession,user]);
  assert.equal((await settle(await order(user,{session_id:legacySession,base_amount_inr:'499.00'}))).outcome,'requires_review');
  await assert.rejects(preflight(q.session_id),/Do not pay again/);
});

test('all Teams settlement and checkout row mutations acquire the account advisory lock first',async()=>{
  const definitions=(await db.query(`select proname,pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace
    and proname in ('complete_blue_teams_checkout','create_blue_teams_checkout','schedule_blue_teams_change','cancel_blue_teams_change')`)).rows;
  assert.equal(definitions.length,4);
  for(const {proname,definition} of definitions) {
    const lock=definition.indexOf('perform pg_advisory_xact_lock');
    const rowLock=definition.search(/for update|update public\.(?:checkout_sessions|team_subscriptions)/i);
    assert.ok(lock>=0&&rowLock>lock,`${proname} takes the common account lock before locking/updating rows`);
  }
});

test('insufficient IMR after collection records review, not another charge or entitlement overwrite',async()=>{
  const user=await account(),q=await quote(user),p=await order(user,q,{imr:100,amount:'449.00'});
  await db.query('update wallets set balance=0 where user_id=$1',[user]);
  assert.equal((await settle(p)).outcome,'requires_review');assert.equal(await row(user),undefined);
  assert.equal((await settle(p)).already_processed,true);
});

test('bad prices, currency changes and wrong provider evidence cannot settle a quote',async()=>{
  const user=await account(),q=await quote(user),p=await order(user,q,{amount:'1.00'});
  await assert.rejects(settle(p),/immutable Teams quote/);
  await assert.rejects(settle({...p,providerOrder:'different'}),/does not match/);
  assert.equal(await row(user),undefined);
});

test('sandbox and public launch prices remain isolated and keep honest paid provenance',async()=>{
  const sandbox=await account();const a=await buy(sandbox,'solo',{sandbox:true,amount:'1.00'});
  assert.equal(a.q.base_amount_inr,'1.00');assert.equal(await row(sandbox),undefined);assert.equal((await row(sandbox,true)).is_test,true);
  const live=await account(),b=await buy(live,'business',{live:true,amount:'1.00'});
  assert.equal(b.q.base_amount_inr,'1.00');assert.equal((await row(live)).plan,'business');
  assert.equal(Number((await db.query('select amount from payment_orders where id=$1',[b.p.id])).rows[0].amount),1);
});

test('legacy paid receipts still activate same-tier access, while conflicting legacy purchases are recorded for review',async()=>{
  const user=await account();await buy(user,'business');const beforeRow=await row(user);
  const session=randomUUID(),legacy={session_id:session,base_amount_inr:'499.00'};
  await db.query(`insert into checkout_sessions(id,user_id,plan,billing_cycle,status,expires_at,metadata)
    values($1,$2,'blue_teams_solo','monthly','pending',now()-interval '1 minute','{}')`,[session,user]);
  const p=await order(user,legacy);assert.equal((await settle(p)).outcome,'requires_review');
  assert.equal((await row(user)).plan,'business');assert.equal(+new Date((await row(user)).current_period_end),+new Date(beforeRow.current_period_end));
  const fresh=await account(),freshSession=randomUUID();
  await db.query(`insert into checkout_sessions(id,user_id,plan,billing_cycle,status,expires_at,metadata)
    values($1,$2,'blue_teams_solo','monthly','pending',now()-interval '1 minute','{}')`,[freshSession,fresh]);
  assert.equal((await settle(await order(fresh,{session_id:freshSession,base_amount_inr:'499.00'}))).outcome,'completed');
  assert.equal((await row(fresh)).plan,'solo');
});

test('ordinary Blue, credits and other users remain untouched; all mutating RPCs are service-only',async()=>{
  const user=await account(),other=await account();
  await db.query("insert into subscriptions(user_id,plan,status,metadata) values($1,'blue','active','{\"keep\":true}')",[user]);
  const beforeOrdinary=(await db.query('select * from subscriptions where user_id=$1',[user])).rows[0];
  await buy(user);const afterOrdinary=(await db.query('select * from subscriptions where user_id=$1',[user])).rows[0];
  assert.deepEqual(afterOrdinary,beforeOrdinary);assert.equal(await row(other),undefined);
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(quote(user,'pro'),/permission denied/);
      await assert.rejects(db.query('select public.schedule_blue_teams_change($1,$2)',[user,'solo']),/permission denied/);
      await assert.rejects(db.query('select public.cancel_blue_teams_change($1)',[user]),/permission denied/);
      await assert.rejects(db.query('select * from blue_teams_payment_reviews'),/permission denied/);
    } finally { await db.exec('reset role'); }
  }
});
