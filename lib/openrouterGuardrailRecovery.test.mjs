import test from 'node:test';
import assert from 'node:assert/strict';
import { assignKeyGuardrail, assertRuntimeModelPolicyAssigned, createAssignedRuntimeModelPolicy, deleteRuntimeModelPolicy } from './openrouterManagement.ts';

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

test('runtime creates the exact policy already attached to one key and cleans up only its own policy', async t => {
  const previousKey = process.env.OPENROUTER_MANAGEMENT_API_KEY;
  const previousWorkspace = process.env.OPENROUTER_WORKSPACE_ID;
  const id = 'fcb1c614-93a2-4505-8196-4744287339bd';
  process.env.OPENROUTER_MANAGEMENT_API_KEY = 'synthetic-management';
  process.env.OPENROUTER_WORKSPACE_ID = 'synthetic-workspace';
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_MANAGEMENT_API_KEY; else process.env.OPENROUTER_MANAGEMENT_API_KEY = previousKey;
    if (previousWorkspace === undefined) delete process.env.OPENROUTER_WORKSPACE_ID; else process.env.OPENROUTER_WORKSPACE_ID = previousWorkspace;
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ path: new URL(url).pathname + new URL(url).search, method: init.method,
      body: init.body && JSON.parse(init.body) });
    if (init.method === 'POST') return Response.json({ data: { id } }, { status: 201 });
    if (init.method === 'DELETE') return Response.json({}, { status: 404 });
    return Response.json({ data: { policy_ids: calls.length === 2 ? [] : [id], opted_out: false } });
  });
  const models = ['vendor/coding', 'vendor/reviewer:free'];
  const reference = await createAssignedRuntimeModelPolicy([...models].reverse(), 'one-child');
  assert.equal(reference, 'model-policy:' + id);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, '/api/v1/guardrails/policies/model-availability');
  assert.deepEqual(calls[0].body.config.allowed_models, models);
  assert.deepEqual(calls[0].body.api_key_hashes, ['one-child']);
  assert.equal(calls[0].body.policy_type, 'model_availability');
  assert.equal(calls[0].body.workspace_id, 'synthetic-workspace');
  assert.equal(calls[0].body.is_workspace_default, undefined);
  await deleteRuntimeModelPolicy(id);
  assert.equal(calls.length, 1, 'keep shared legacy guardrails');
  await assertRuntimeModelPolicyAssigned(reference, 'one-child');
  const readPath = '/api/v1/guardrails/policies/assignments/api-keys/one-child?workspace_id=synthetic-workspace&policy_type=model_availability';
  assert.deepEqual(calls.slice(1).map(call => call.path), [readPath, readPath]);
  await deleteRuntimeModelPolicy(reference);
  assert.equal(calls[3].method, 'DELETE');
  assert.equal(calls[3].path, '/api/v1/guardrails/policies/model-availability/' + id + '?workspace_id=synthetic-workspace');
});
