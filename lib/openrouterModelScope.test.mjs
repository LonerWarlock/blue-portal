import test from 'node:test';
import assert from 'node:assert/strict';
import { assertManagedKeyCanUseModelSet } from './openrouterManagement.ts';

const selected = [
  { model: 'vendor/coding-20261017:free', aliases: ['vendor/coding:free'] },
  { model: 'vendor/reviewer-20260813:free', aliases: ['vendor/reviewer:free'] }
];
const restricted = [{ id: 'vendor/coding:free' }, { id: 'vendor/reviewer:free' }];
const broad = [...restricted, { id: 'vendor/unrelated-paid' }];

function clockFixture(t, respond) {
  let elapsed = 0;
  const calls = [], delays = [];
  t.mock.method(Date, 'now', () => elapsed);
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    elapsed += delay;
    delays.push(delay);
    queueMicrotask(callback);
    return 0;
  });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: String(url), authorization: init.headers.Authorization });
    return respond(elapsed);
  });
  return { calls, delays, elapsed: () => elapsed };
}

test('an assigned key can finish propagating after the old two-second verification window', async t => {
  const fixture = clockFixture(t, elapsed => Response.json({ data: elapsed < 12_000 ? broad : restricted }));
  await assertManagedKeyCanUseModelSet('same-private-child', selected);
  assert.ok(fixture.elapsed() >= 12_000);
  assert.ok(fixture.elapsed() <= 20_000);
  assert.ok(fixture.calls.length > 8, 'allow the observed propagation beyond the previous four reads');
  assert.ok(fixture.calls.every(call => call.authorization === 'Bearer same-private-child'));
  assert.ok(fixture.calls.every(call => call.url.startsWith('https://openrouter.ai/api/v1/models/user')));
});

test('a permanently broader model set still fails within the bounded verification window', async t => {
  const fixture = clockFixture(t, () => Response.json({ data: broad }));
  await assert.rejects(assertManagedKeyCanUseModelSet('same-private-child', selected),
    /not restricted to the selected model/);
  assert.ok(fixture.elapsed() <= 20_000);
  assert.ok(fixture.calls.length <= 16);
  assert.ok(fixture.calls.every(call => call.authorization === 'Bearer same-private-child'));
});

test('a fully propagated model pair keeps the first-read fast path', async t => {
  const fixture = clockFixture(t, () => Response.json({ data: restricted }));
  await assertManagedKeyCanUseModelSet('same-private-child', selected);
  assert.equal(fixture.calls.length, 2);
  assert.deepEqual(fixture.delays, []);
});

test('missing model access and authentication failures keep their shorter existing retry budget', async t => {
  for (const respond of [
    () => Response.json({ data: [{ id: 'vendor/unrelated-paid' }] }),
    () => Response.json({ error: 'Unauthorized' }, { status: 401 })
  ]) {
    const fixture = clockFixture(t, respond);
    await assert.rejects(assertManagedKeyCanUseModelSet('same-private-child', selected));
    assert.equal(fixture.calls.length, 6);
    assert.equal(fixture.elapsed(), 750);
    t.mock.restoreAll();
  }
});

test('waiting for scope propagation never accepts a paid variant of a free selection', async t => {
  const fixture = clockFixture(t, () => Response.json({ data: [...restricted,
    { id: 'vendor/coding', canonical_slug: 'vendor/coding-20261017' }] }));
  await assert.rejects(assertManagedKeyCanUseModelSet('same-private-child', selected),
    /not restricted to the selected model/);
  assert.ok(fixture.elapsed() <= 20_000);
});
