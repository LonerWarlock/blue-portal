import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { normalizedUsage } from './usageAccounting.ts';
import {
  configuredBlueCreditMultiplier,
  DEFAULT_BLUE_CREDIT_MULTIPLIER
} from './blueCreditPolicy.ts';

const paidPricing = {
  prompt: 0.001,
  completion: 0.002,
  request: 0.01,
  cacheRead: 0.0001,
  cacheWrite: 0.0002,
  cacheOutput: 0.0002,
  reasoning: 0.003,
  free: false
};

test('authoritative provider cost wins for paid models', () => {
  const usage = normalizedUsage({
    prompt_tokens: 100,
    completion_tokens: 50,
    reasoning_tokens: 10,
    cache_read_tokens: 25,
    cost: 0.42
  }, 1, 1, paidPricing);
  assert.equal(usage.cost, 0.42);
  assert.equal(usage.costSource, 'provider');
  assert.equal(usage.reasoningTokens, 10);
  assert.equal(usage.cacheReadTokens, 25);
});

test('catalogued free models always charge zero Blue Credits upstream cost', () => {
  const usage = normalizedUsage({
    prompt_tokens: 1000,
    completion_tokens: 500,
    cost: 9.99
  }, 1, 1, { ...paidPricing, free: true });
  assert.equal(usage.cost, 0);
  assert.equal(usage.costSource, 'free-model');
});

test('zero-cost reservations are explicitly supported and remain idempotent', async () => {
  const migration = await readFile(new URL('../supabase/migrations/007_zero_cost_reservations.sql', import.meta.url), 'utf8');
  assert.match(migration, /amount_param < 0/);
  assert.match(migration, /if amount_param > 0 then/);
  assert.match(migration, /reserved_blue_credits >= 0/);
  assert.match(migration, /existing_record\.status = 'released'/);
  assert.match(migration, /'accepted', false/);
  assert.match(migration, /'reactivated', true/);
  assert.match(migration, /where request_id = request_id_param/);
  assert.doesNotMatch(migration, /amount_param <= 0/);
});

test('new Blue usage settles one-for-one; a stale environment multiplier cannot charge the checkout fee twice', async () => {
  const migration = await readFile(new URL('../supabase/migrations/036_blue_teams_credits_and_platform_fee.sql', import.meta.url),'utf8');
  assert.equal(DEFAULT_BLUE_CREDIT_MULTIPLIER,1);
  for (const value of [undefined,'invalid','0.5','1.5',3]) assert.equal(configuredBlueCreditMultiplier(value),1);
  assert.match(migration,/charge:=round\(provider_cost_param\*reservation_record.credit_multiplier,10\)/);
  assert.match(migration,/alter column credit_multiplier set default 1/);
});
