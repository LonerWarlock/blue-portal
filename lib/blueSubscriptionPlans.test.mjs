import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { BLUE_SUBSCRIPTION_PLANS, getBlueSubscriptionPlan, bluePlanPriceInr, bluePlanSavings } from './blueSubscriptionPlans.ts';

let db;
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create table checkout_sessions(id uuid primary key, user_id uuid not null references auth.users(id),
      plan text not null, billing_cycle text not null, status text not null default 'pending',
      expires_at timestamptz not null, completed_at timestamptz, metadata jsonb default '{}');
    create table subscriptions(id uuid primary key default gen_random_uuid(), user_id uuid unique not null references auth.users(id),
      plan text, status text, current_period_start timestamptz, current_period_end timestamptz,
      stripe_subscription_id text, stripe_customer_id text, metadata jsonb, updated_at timestamptz);
    create table wallets(user_id uuid primary key references auth.users(id), balance numeric not null default 0, updated_at timestamptz);`);
  await db.exec(await readFile(new URL('../supabase/migrations/026_blue_subscription_billing_cycles.sql', import.meta.url), 'utf8'));
});
after(async () => { await db?.close(); });

async function checkout(cycle = 'monthly', options = {}) {
  const user = options.user || randomUUID(), session = randomUUID(), order = randomUUID();
  const provider = options.provider || 'payu', providerOrder = randomUUID(), transaction = randomUUID();
  await db.query('insert into auth.users values($1,$2) on conflict do nothing', [user, 'billing@test.invalid']);
  await db.query('insert into wallets(user_id,balance) values($1,200) on conflict do nothing', [user]);
  await db.query(`insert into checkout_sessions(id,user_id,plan,billing_cycle,expires_at)
    values($1,$2,'blue',$3,now()+interval '15 minutes')`, [session,user,cycle]);
  await db.query(`insert into payment_orders(id,checkout_session_id,user_id,product_sku,amount,currency,redeemed_imr,gateway,provider_order_id,expires_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '15 minutes')`,
    [order,session,user,options.sku || `blue_${cycle}`, options.amount ?? (cycle === 'monthly' && provider === 'paypal' ? '1.99' : bluePlanPriceInr(cycle, options.imr || 0)),
      options.currency || (provider === 'paypal' ? 'USD' : 'INR'), options.imr || 0, provider,providerOrder]);
  return { user, session, order, provider, providerOrder, transaction };
}
async function complete(c) {
  return (await db.query('select complete_blue_subscription_checkout($1::uuid,$2,$3,$4,$5) as receipt',
    [c.session,c.provider,c.providerOrder,c.transaction,'billing@test.invalid'])).rows[0].receipt;
}
async function subscription(user) { return (await db.query('select * from subscriptions where user_id=$1', [user])).rows[0]; }
async function balance(user) { return Number((await db.query('select balance from wallets where user_id=$1', [user])).rows[0].balance); }

test('trusted catalogue has exact prices, terms, savings and rejects unknown cycles', () => {
  assert.deepEqual(Object.values(BLUE_SUBSCRIPTION_PLANS).map(p => [p.priceInr,p.days]), [[149,30],[399,90],[1299,365]]);
  for (const bad of ['weekly','__proto__','constructor',null,{},0]) assert.equal(getBlueSubscriptionPlan(bad), null);
  assert.equal(bluePlanSavings('quarterly'),11); assert.equal(bluePlanSavings('yearly'),27);
  assert.equal(bluePlanPriceInr('quarterly',100),'349.00'); assert.equal(bluePlanPriceInr('yearly',1),'1298.50');
  for (const invalid of [NaN,Infinity,-1,101]) assert.throws(() => bluePlanPriceInr('monthly',invalid));
});
for (const cycle of ['monthly','quarterly','yearly']) {
  test(`${cycle} payment grants exactly its duration with the existing Blue entitlement`, async () => {
    const c = await checkout(cycle), receipt = await complete(c), s = await subscription(c.user);
    assert.equal(receipt.duration_days, BLUE_SUBSCRIPTION_PLANS[cycle].days);
    assert.equal((new Date(s.current_period_end)-new Date(s.current_period_start))/86400000, BLUE_SUBSCRIPTION_PLANS[cycle].days);
    assert.equal(s.plan,'blue'); assert.equal(s.status,'active'); assert.equal(s.metadata.billing_cycle,cycle);
  });
}
test('duplicate callback charges IMR and extends time only once', async () => {
  const c = await checkout('quarterly',{ imr:100 });
  assert.equal((await complete(c)).already_processed,false);
  const first = await subscription(c.user);
  assert.equal((await complete(c)).already_processed,true);
  assert.equal(await balance(c.user),100);
  assert.equal(+new Date((await subscription(c.user)).current_period_end),+new Date(first.current_period_end));
  await assert.rejects(complete({...c,providerOrder:randomUUID()}), /does not match/);
});
test('renewal extends active access and preserves existing metadata', async () => {
  const c = await checkout('yearly');
  await db.query(`insert into subscriptions(user_id,plan,status,current_period_start,current_period_end,metadata)
    values($1,'blue','active',now()-interval '2 days',now()+interval '20 days','{"source":"pre_registration"}')`,[c.user]);
  const prior = await subscription(c.user);
  await complete(c);
  const next = await subscription(c.user);
  assert.equal((new Date(next.current_period_end)-new Date(prior.current_period_end))/86400000,365);
  assert.equal(+new Date(next.current_period_start),+new Date(prior.current_period_start)); assert.equal(next.metadata.source,'pre_registration');
});
test('expired access restarts today instead of extending an expired date', async () => {
  const c = await checkout('quarterly');
  await db.query(`insert into subscriptions(user_id,plan,status,current_period_start,current_period_end)
    values($1,'blue','active',now()-interval '50 days',now()-interval '20 days')`,[c.user]);
  await complete(c);
  const next = await subscription(c.user);
  assert.equal((new Date(next.current_period_end)-new Date(next.current_period_start))/86400000,90);
  assert.ok(Math.abs(Date.now()-new Date(next.current_period_start))<5000);
});
test('multiple completed checkouts for a user add both periods', async () => {
  const first = await checkout('monthly'), second = await checkout('quarterly',{ user:first.user });
  await Promise.all([complete(first),complete(second)]);
  const s = await subscription(first.user);
  assert.equal((new Date(s.current_period_end)-new Date(s.current_period_start))/86400000,120);
});
test('wrong price, SKU or provider cannot activate access or spend IMR', async () => {
  for (const options of [{ amount:149 },{ sku:'blue_monthly' },{ provider:'paypal',amount:1.99 }]) {
    const c = await checkout('yearly',options);
    await assert.rejects(complete(c), /does not match|Unsupported payment currency/);
    assert.equal(await subscription(c.user),undefined); assert.equal(await balance(c.user),200);
    assert.equal((await db.query('select status from checkout_sessions where id=$1',[c.session])).rows[0].status,'pending');
  }
});
test('existing monthly USD checkout is accepted; other currencies/cycles are rejected', async () => {
  const c = await checkout('monthly',{provider:'paypal'});
  assert.equal((await complete(c)).duration_days,30);
  const bad = await checkout('quarterly',{provider:'paypal',amount:1.99});
  await assert.rejects(complete(bad),/Unsupported payment currency/);
});
test('insufficient IMR rolls back all checkout writes', async () => {
  const c = await checkout('yearly',{ imr:100 });
  await db.query('update wallets set balance=10 where user_id=$1',[c.user]);
  await assert.rejects(complete(c),/Insufficient IMR/);
  assert.equal(await balance(c.user),10); assert.equal(await subscription(c.user),undefined);
  assert.equal((await db.query('select status from payment_orders where id=$1',[c.order])).rows[0].status,'pending');
});
test('unbounded pre-existing access is not shortened', async () => {
  const c = await checkout('monthly');
  await db.query("insert into subscriptions(user_id,plan,status,current_period_end) values($1,'blue','active',null)",[c.user]);
  await complete(c); assert.equal((await subscription(c.user)).current_period_end,null);
});
test('expired sessions and unsupported billing cycles cannot complete', async () => {
  const c = await checkout('quarterly');
  await db.query("update checkout_sessions set expires_at=now()-interval '1 second' where id=$1",[c.session]);
  await assert.rejects(complete(c),/not active/);
  const bad = await checkout('monthly');
  await db.query("update checkout_sessions set billing_cycle='weekly' where id=$1",[bad.session]);
  await assert.rejects(complete(bad),/Unsupported billing cycle/);
});
test('browser roles cannot invoke settlement or write trusted orders', async () => {
  const c = await checkout('monthly');
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(complete(c),/permission denied/);
      await assert.rejects(db.query("update payment_orders set amount=1 where id=$1",[c.order]),/permission denied/);
    } finally { await db.exec('reset role'); }
  }
});
