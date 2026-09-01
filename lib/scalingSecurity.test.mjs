import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  matchesExpectedPayuPayment,
  payuCallbackHash,
  safeInternalUrl,
  validPayuCallbackSignature
} from './paymentSecurity.ts';

test('PayU callbacks require the valid reverse signature and stored order fields', () => {
  const salt = 'test-salt';
  const data = {
    key: 'merchant-key',
    txnid: 'c2c_123456789',
    amount: '149.00',
    productinfo: 'Blue Subscription',
    firstname: 'Tester',
    email: 'test@example.com',
    status: 'success'
  };
  data.hash = payuCallbackHash(data, salt);
  assert.equal(validPayuCallbackSignature(data, salt), true);
  assert.equal(validPayuCallbackSignature({ ...data, amount: '1.00' }, salt), false);
  assert.equal(matchesExpectedPayuPayment(data, data), true);
  assert.equal(matchesExpectedPayuPayment(data, { ...data, amount: '1.00' }), false);
});

test('checkout redirects cannot leave the configured site origin', () => {
  const site = 'https://blue.example';
  assert.equal(safeInternalUrl('/console?payment=1', site, '/console').origin, site);
  assert.equal(safeInternalUrl('https://attacker.example/phish', site, '/console').href, `${site}/console`);
});

test('scaling migrations implement atomic queueing, hashed keys, payment settlement and outbox claims', async () => {
  const [queue, security, outbox] = await Promise.all([
    readFile(new URL('../supabase/migrations/020_blue_runtime_global_queue.sql', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/021_security_payment_and_api_keys.sql', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/022_job_outbox.sql', import.meta.url), 'utf8')
  ]);

  assert.match(queue, /pg_advisory_xact_lock/);
  assert.match(queue, /for update skip locked/i);
  assert.match(queue, /queue is full/i);
  assert.match(queue, /paid_streak/i);
  assert.match(security, /digest\(key, 'sha256'\)/i);
  assert.match(security, /create table if not exists public\.payment_orders/i);
  assert.match(security, /complete_blue_subscription_checkout/i);
  assert.match(security, /blue_usage_summary/i);
  assert.match(security, /user_keys_user_id_idx/i);
  assert.match(security, /for update/i);
  assert.match(security, /to service_role/i);

  assert.match(outbox, /create table if not exists public\.job_outbox/i);
  assert.match(outbox, /for update skip locked/i);
  assert.match(outbox, /'dead'/i);
});
