import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveAccountPlan } from './accountPlan.ts';
const wallet = credits => ({ account_type: 'pro_payg', blue_credits: credits });
const active = { status: 'active' };
test('zero, negative, missing and non-finite Blue credits never grant Pro', () => {
  for (const credits of [0, -1, undefined, 'bad', Infinity]) {
    const plan = effectiveAccountPlan(wallet(credits), active, null);
    assert.equal(plan.plan, 'lite'); assert.equal(plan.is_pro, false);
  }
});
test('positive credits require an active PAYG account, not just a balance', () => {
  assert.equal(effectiveAccountPlan(wallet(0.001), active, null).plan, 'blue_pro');
  assert.equal(effectiveAccountPlan(wallet(10), { status: 'inactive' }, null).plan, 'lite');
  assert.equal(effectiveAccountPlan({ blue_credits: 10 }, active, null).plan, 'lite');
});
test('an independent active monthly subscription survives PAYG exhaustion', () => {
  assert.equal(effectiveAccountPlan(wallet(0), active, { plan: 'blue', status: 'active', current_period_end: '2030-01-01' }, 1000).plan, 'blue');
});
test('expired, invalid, cancelled or unknown subscriptions fail closed', () => {
  for (const subscription of [
    { plan: 'blue', status: 'active', current_period_end: '2000-01-01' },
    { plan: 'blue', status: 'active', current_period_end: 'bad' },
    { plan: 'blue', status: 'cancelled' }, { plan: 'premium', status: 'active' },
  ]) assert.equal(effectiveAccountPlan(null, null, subscription).plan, 'lite');
});

test('a timed Blue plan remains visible alongside independent Pro credits and keeps its actual duration', () => {
  const expiry='2030-01-01T00:00:00.000Z';
  const plan=effectiveAccountPlan(wallet(40),active,{plan:'blue',status:'active',current_period_end:expiry,metadata:{billing_cycle:'quarterly'}},1000);
  assert.equal(plan.plan,'blue_pro'); assert.equal(plan.is_pro,true);
  assert.equal(plan.monthly_plan,'blue'); assert.equal(plan.monthly_expires_at,expiry); assert.equal(plan.billing_cycle,'quarterly');
  for (const billing_cycle of ['unknown',{},null]) assert.equal(effectiveAccountPlan(null,null,{plan:'blue',status:'active',current_period_end:expiry,metadata:{billing_cycle}},1000).billing_cycle,null);
});
