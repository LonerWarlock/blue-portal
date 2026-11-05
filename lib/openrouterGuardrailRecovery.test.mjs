import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { assignKeyGuardrail } from './openrouterManagement.ts';

async function fixture(run, failure = { status: 404, error: 'Guardrail not found' }) {
  const original = global.fetch, previous = process.env.OPENROUTER_MANAGEMENT_API_KEY, calls = [];
  process.env.OPENROUTER_MANAGEMENT_API_KEY = 'synthetic-management';
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return calls.length === 1 ? Response.json({ error: failure.error }, { status: failure.status }) : Response.json({ assigned_count: 1 });
  };
  try { await run(calls); } finally {
    global.fetch = original;
    if (previous === undefined) delete process.env.OPENROUTER_MANAGEMENT_API_KEY; else process.env.OPENROUTER_MANAGEMENT_API_KEY = previous;
  }
}

test('a missing policy is repaired once without creating another key or widening the assignment', async () => {
  await fixture(async calls => {
    let repaired = 0;
    await assignKeyGuardrail('missing-policy', 'same-child-key', async id => { repaired++; assert.equal(id, 'missing-policy'); return 'replacement-policy'; });
    assert.equal(repaired, 1); assert.equal(calls.length, 2);
    assert.ok(calls[0].url.endsWith('/guardrails/missing-policy/assignments/keys'));
    assert.ok(calls[1].url.endsWith('/guardrails/replacement-policy/assignments/keys'));
    assert.deepEqual(calls.map(call => call.body.key_hashes), [['same-child-key'], ['same-child-key']]);
  });
});

for (const failure of [{ status: 401, error: 'Guardrail not found' }, { status: 404, error: 'Key not found' }, { status: 403, error: 'Permission denied' }]) {
  test(`policy recovery does not mask ${failure.status}: ${failure.error}`, async () => fixture(async calls => {
    let repaired = false;
    await assert.rejects(assignKeyGuardrail('policy', 'child', async () => { repaired = true; return 'other'; }));
    assert.equal(repaired, false); assert.equal(calls.length, 1);
  }, failure));
}

test('guardrail repair refuses an unchanged policy and never loops on a second missing assignment', async () => {
  await fixture(async calls => {
    await assert.rejects(assignKeyGuardrail('missing', 'child', async () => 'missing'), /could not replace/);
    assert.equal(calls.length, 1);
  });
  const original = global.fetch, previous = process.env.OPENROUTER_MANAGEMENT_API_KEY;
  process.env.OPENROUTER_MANAGEMENT_API_KEY = 'synthetic-management'; let calls = 0, repairs = 0;
  global.fetch = async () => { calls++; return Response.json({ error: 'Guardrail not found' }, { status: 404 }); };
  try {
    await assert.rejects(assignKeyGuardrail('missing', 'child', async () => { repairs++; return 'replacement'; }), /404/);
    assert.equal(calls, 2); assert.equal(repairs, 1);
  } finally { global.fetch = original; if (previous === undefined) delete process.env.OPENROUTER_MANAGEMENT_API_KEY; else process.env.OPENROUTER_MANAGEMENT_API_KEY = previous; }
});

test('a known missing mapping is replaced by compare-and-swap, preserving other live policies', async () => {
  const source = await readFile(new URL('./blueRuntime.ts', import.meta.url), 'utf8');
  const section = source.slice(source.indexOf('async function ensureModelSetGuardrail('), source.indexOf('async function remainingProviderAllowanceForTask('));
  const updates = [], deleted = [], matches = [];
  const context = {
    supabaseAdmin: { from: () => {
      let update;
      const query = { select: () => query, eq: () => query, update: value => { update = value; updates.push(value); return query; },
        maybeSingle: async () => ({ data: { guardrail_id: update ? 'replacement' : 'missing' } }) };
      return query;
    } },
    exactModelGuardrailMatches: async id => { matches.push(id); return true; },
    exactModelSetGuardrailMatches: async () => true,
    createModelGuardrail: async () => 'replacement', createModelSetGuardrail: async () => 'replacement',
    deleteGuardrail: async id => deleted.push(id), Date, Error
  };
  vm.runInNewContext(stripTypeScriptTypes(section), context);
  assert.equal(await context.ensureModelGuardrail('vendor/model', undefined, 'missing'), 'replacement');
  assert.equal(updates.length, 1); assert.equal(updates[0].guardrail_id, 'replacement');
  assert.equal(matches.length, 0, 'do not reuse a policy whose assignment just proved it missing');
  assert.deepEqual(deleted, [], 'never delete or widen the old shared live guardrail');
});
