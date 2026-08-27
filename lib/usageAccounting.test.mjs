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

test('Blue settles authoritative provider cost at exactly 1.5 Blue Credits per provider dollar', async () => {
  const [payg, migration] = await Promise.all([
    readFile(new URL('./bluePayg.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/004_payg_production.sql', import.meta.url), 'utf8')
  ]);
  assert.match(payg, /configuredBlueCreditMultiplier/);
  assert.match(payg, /blue_credit_multiplier_param: BLUE_CREDIT_MULTIPLIER/);
  assert.match(migration, /charge := round\(provider_cost_param \* blue_credit_multiplier_param, 10\)/);
  assert.equal(Number((1 * 1.5).toFixed(10)), 1.5);
  assert.equal(Number((0.08 * 1.5).toFixed(10)), 0.12);
  assert.equal(DEFAULT_BLUE_CREDIT_MULTIPLIER, 1.5);
  assert.equal(configuredBlueCreditMultiplier(undefined), 1.5);
  assert.equal(configuredBlueCreditMultiplier('invalid'), 1.5);
  assert.equal(configuredBlueCreditMultiplier('0.5'), 1.5);
  assert.equal(configuredBlueCreditMultiplier('1.5'), 1.5);
});
