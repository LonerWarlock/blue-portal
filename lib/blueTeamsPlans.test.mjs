import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { BLUE_TEAMS_PLANS, BLUE_TEAMS_TEST_PRICE_INR, BLUE_TEAMS_TEST_PRICE_USD,
  getBlueTeamsPlan, getBlueTeamsPriceInr, getBlueTeamsPriceUsd, getBlueTeamsTierFromCheckoutPlan, isBlueTeamsTier } from './blueTeamsPlans.ts';

let db;
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create table checkout_sessions(id uuid primary key, user_id uuid not null references auth.users(id),
      plan text not null, billing_cycle text not null, status text not null default 'pending',
      expires_at timestamptz not null, completed_at timestamptz, metadata jsonb default '{}');
    create table subscriptions(id uuid primary key default gen_random_uuid(), user_id uuid unique not null references auth.users(id),
      plan text, status text, current_period_start timestamptz, current_period_end timestamptz,
      stripe_subscription_id text, stripe_customer_id text, metadata jsonb, updated_at timestamptz);
    create table wallets(user_id uuid primary key references auth.users(id), balance numeric not null default 0, updated_at timestamptz);`);
  await db.exec(await readFile(new URL('../supabase/migrations/026_blue_subscription_billing_cycles.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/031_blue_teams_checkout.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/032_blue_teams_live_business_launch_test.sql', import.meta.url), 'utf8'));
});
after(async () => { await db?.close(); });

function checkoutPrice(tier, testMode, provider, redeemedImr = 0, liveTestMode = false) {
  return provider === 'paypal' ? getBlueTeamsPriceUsd(tier, testMode, redeemedImr, liveTestMode) : getBlueTeamsPriceInr(tier, testMode, redeemedImr, liveTestMode);
}
async function createCheckout({ tier = 'solo', testMode = false, liveTestMode = false, provider = 'payu', amount, sku, redeemedImr = 0, user = randomUUID() } = {}) {
  const sessionId = randomUUID(), orderId = randomUUID(), providerOrderId = randomUUID();
  await db.query('insert into auth.users values($1,$2) on conflict do nothing', [user, 'teams@test.invalid']);
  const plan = BLUE_TEAMS_PLANS[tier];
  await db.query(`insert into checkout_sessions(id,user_id,plan,billing_cycle,expires_at,metadata)
    values($1,$2,$3,'monthly',now()+interval '15 minutes',$4::jsonb)`, [sessionId,user,`blue_teams_${tier}`,JSON.stringify({
      product_kind:'blue_teams',product_sku:plan.sku,blue_teams_test_mode:testMode,blue_teams_live_test_mode:liveTestMode,
    })]);
  await db.query(`insert into payment_orders(id,checkout_session_id,user_id,product_sku,amount,currency,redeemed_imr,gateway,provider_order_id,custom_id,expires_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,now()+interval '15 minutes')`, [orderId,sessionId,user,sku || plan.sku,
      amount ?? checkoutPrice(tier,testMode,provider,redeemedImr,liveTestMode),provider === 'paypal' ? 'USD' : 'INR',redeemedImr,provider,providerOrderId]);
  return { user, sessionId, providerOrderId, provider, transactionId: randomUUID() };
}
async function complete(c, transactionId = c.transactionId) {
  return (await db.query('select complete_blue_teams_checkout($1::uuid,$2,$3,$4,$5) as result',
    [c.sessionId,c.provider,c.providerOrderId,transactionId,'teams@test.invalid'])).rows[0].result;
}
async function teamEntitlements(user) {
  return (await db.query('select * from team_subscriptions where user_id=$1 order by is_test', [user])).rows;
}

test('catalogue matches the published Teams tiers and rejects arbitrary tiers', () => {
  assert.deepEqual(Object.values(BLUE_TEAMS_PLANS).map(p => [p.priceInr,p.projectTeams,p.agentsPerTeam]),
    [[499,1,3],[1499,3,5],[4999,10,8]]);
  assert.deepEqual(Object.values(BLUE_TEAMS_PLANS).map(p => p.days), [30,30,30]);
  assert.deepEqual(Object.values(BLUE_TEAMS_PLANS).map(p => p.sku), [
    'blue_teams_solo_monthly','blue_teams_pro_monthly','blue_teams_business_monthly',
  ]);
  assert.equal(BLUE_TEAMS_TEST_PRICE_INR,1); assert.equal(BLUE_TEAMS_TEST_PRICE_USD,0.01);
  assert.equal(getBlueTeamsPriceInr('solo',true),'1.00'); assert.equal(getBlueTeamsPriceUsd('solo',true),'0.01');
  assert.equal(getBlueTeamsPriceInr('pro',true),'1499.00'); assert.equal(getBlueTeamsPriceUsd('business',true),'52.78');
  assert.equal(isBlueTeamsTier('solo'),true); assert.equal(isBlueTeamsTier('__proto__'),false);
  assert.equal(getBlueTeamsPlan('constructor'),null); assert.equal(getBlueTeamsTierFromCheckoutPlan('blue_teams_pro'),'pro');
  assert.equal(getBlueTeamsTierFromCheckoutPlan('blue_teams_pro_monthly'),null);
});

for (const provider of ['payu','paypal']) {
  test(`sandbox Solo checkout through ${provider} grants only a test entitlement`, async () => {
    const c = await createCheckout({ tier:'solo', testMode:true, provider });
    const result = await complete(c);
    const [entitlement] = await teamEntitlements(c.user);
    assert.equal(result.status,'completed'); assert.equal(result.test_mode,true); assert.equal(result.plan,'solo');
    assert.equal(entitlement.is_test,true); assert.equal(entitlement.plan,'solo'); assert.equal(entitlement.status,'active');
    assert.equal((new Date(entitlement.current_period_end)-new Date(entitlement.current_period_start))/86400000,30);
    assert.equal((await db.query('select count(*)::int as count from subscriptions where user_id=$1',[c.user])).rows[0].count,0);
  });
}

test('live INR/PayPal amounts grant all three production tiers for 30 days', async () => {
  for (const tier of ['solo','pro','business']) {
    const c = await createCheckout({ tier, provider:tier === 'pro' ? 'paypal' : 'payu' });
    const result = await complete(c);
    const [entitlement] = await teamEntitlements(c.user);
    assert.equal(result.test_mode,false); assert.equal(result.plan,tier);
    assert.equal(entitlement.plan,tier); assert.equal(entitlement.is_test,false);
    assert.equal((new Date(entitlement.current_period_end)-new Date(entitlement.current_period_start))/86400000,30);
  }
});

test('a repeated verified callback grants time once and preserves distinct test/live entitlements', async () => {
  const live = await createCheckout({ tier:'pro' });
  await complete(live);
  const first = await teamEntitlements(live.user);
  assert.equal((await complete(live)).already_processed,true);
  assert.equal(+new Date((await teamEntitlements(live.user)).find(x => !x.is_test).current_period_end),
    +new Date(first.find(x => !x.is_test).current_period_end));
  const sandbox = await createCheckout({ tier:'solo', testMode:true, user:live.user });
  await complete(sandbox);
  const both = await teamEntitlements(live.user);
  assert.equal(both.length,2); assert.equal(both.find(x => !x.is_test).plan,'pro'); assert.equal(both.find(x => x.is_test).plan,'solo');
});

test('wrong price, SKU, provider or currency cannot activate a team entitlement', async () => {
  for (const options of [
    { tier:'solo', amount:'1.00' },
    { tier:'pro', sku:'blue_teams_solo_monthly' },
    { tier:'business', provider:'paypal', amount:'1.99' },
  ]) {
    const c = await createCheckout(options);
    await assert.rejects(complete(c), /does not match|Unsupported payment currency/);
    assert.deepEqual(await teamEntitlements(c.user),[]);
    assert.equal((await db.query('select status from checkout_sessions where id=$1',[c.sessionId])).rows[0].status,'pending');
  }
});

test('a sandbox Solo amount is rejected when the checkout was not marked as a test', async () => {
  const c = await createCheckout({ tier:'solo', testMode:false, amount:'1.00' });
  await assert.rejects(complete(c), /amount does not match/);
  assert.deepEqual(await teamEntitlements(c.user),[]);
});

test('the ₹1 Business live launch test grants a live Business entitlement', async () => {
  const c = await createCheckout({ tier:'business', liveTestMode:true, provider:'payu' });
  const result = await complete(c);
  const [entitlement] = await teamEntitlements(c.user);
  assert.equal(result.status, 'completed');
  assert.equal(result.live_test_mode, true); assert.equal(result.test_mode, false);
  assert.equal(entitlement.is_test, false); assert.equal(entitlement.plan, 'business');
  assert.equal(entitlement.metadata.purchase_mode, 'live_launch_test');
});

test('a live Team checkout applies IMR once, then changes the active Team plan', async () => {
  const user = randomUUID();
  await db.query('insert into auth.users values($1,$2)', [user, 'imr-team@test.invalid']);
  await db.query('insert into wallets(user_id,balance) values($1,25)', [user]);
  const first = await createCheckout({ user, tier:'solo', provider:'payu', redeemedImr:20 });
  await complete(first);
  const walletAfterFirst = await db.query('select balance from wallets where user_id=$1', [user]);
  assert.equal(Number(walletAfterFirst.rows[0].balance),5);
  assert.equal((await complete(first)).already_processed, true);
  const walletAfterReplay = await db.query('select balance from wallets where user_id=$1', [user]);
  assert.equal(Number(walletAfterReplay.rows[0].balance),5);

  const upgrade = await createCheckout({ user, tier:'pro', provider:'payu' });
  await complete(upgrade);
  const [entitlement] = await teamEntitlements(user);
  assert.equal(entitlement.plan, 'pro');
});
