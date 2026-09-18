import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountCache, PROFILE_CACHE_TTL_MS, WALLET_CACHE_TTL_MS } from './accountCache.ts';

const payload = (user = 'a', balance = 10, plan = 'blue') => ({
  user_id: user, wallet: { balance }, subscription: { plan, is_pro: plan === 'blue_pro', discount: 0 },
  blue_pro: { wallet: { blue_credits: 1 }, key: { key: 'masked-only', masked: true } },
});
const response = data => new Response(JSON.stringify(data));

test('navigation reuses account; wallet and profile have separate TTLs', async () => {
  let now = 1000; const calls = [];
  const cache = new AccountCache(async url => { calls.push(url); return response(payload()); }, () => now);
  cache.setAccount('a');
  await cache.get('token');
  for (let i = 0; i < 10; i++) await cache.get('token');
  assert.deepEqual(calls, ['/api/me/bootstrap']);
  now += WALLET_CACHE_TTL_MS;
  await cache.get('token');
  assert.equal(calls.at(-1), '/api/me/bootstrap?scope=wallet');
  assert.equal(cache.peek().blue_pro.key.key, 'masked-only');
  now = 1000 + PROFILE_CACHE_TTL_MS;
  await cache.get('token');
  assert.equal(calls.at(-1), '/api/me/bootstrap');
});
test('concurrent page loads share one request', async () => {
  let resolve; let count = 0;
  const cache = new AccountCache(() => { count++; return new Promise(r => resolve = r); });
  cache.setAccount('a');
  const first = cache.get('token'); const second = cache.get('token');
  resolve(response(payload())); await Promise.all([first, second]);
  assert.equal(count, 1);
});
test('coupon/payment invalidation bypasses both TTLs immediately', async () => {
  let count = 0;
  const cache = new AccountCache(async () => response(payload('a', ++count * 10)));
  cache.setAccount('a'); await cache.get('token'); cache.invalidate();
  assert.equal((await cache.get('token', true)).wallet.balance, 20);
});
test('late requests cannot leak account A into account B', async () => {
  let resolve;
  const cache = new AccountCache(() => new Promise(r => resolve = r));
  cache.setAccount('a'); const pending = cache.get('token');
  cache.setAccount('b'); resolve(response(payload('a')));
  await assert.rejects(pending, /Account changed/); assert.equal(cache.peek(), null);
});
test('failed refresh never extends TTL or turns a paid account into Lite', async () => {
  let now = 1000; let fail = false; let count = 0;
  const cache = new AccountCache(async () => { count++; return fail
    ? new Response(JSON.stringify({ error: 'Offline' }), { status: 503 }) : response(payload()); }, () => now);
  cache.setAccount('a'); await cache.get('token'); now += WALLET_CACHE_TTL_MS; fail = true;
  await assert.rejects(cache.get('token'), /Offline/);
  await assert.rejects(cache.get('token'), /Offline/);
  assert.equal(count, 3); assert.equal(cache.peek().subscription.plan, 'blue');
});
test('wrong-user payload is rejected and logout clears private cached data', async () => {
  const cache = new AccountCache(async () => response(payload('other')));
  cache.setAccount('a'); await assert.rejects(cache.get('token'), /Invalid account/);
  cache.setAccount(null); assert.equal(cache.peek(), null);
  await assert.rejects(cache.get('token'), /Sign in/);
});
