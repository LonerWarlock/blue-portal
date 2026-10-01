import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { approvalReviewerFromCatalog, BLUE_APPROVAL_REVIEWER_MODEL, normalizeApprovalReviewer,
  reviewedRuntimeReplayAllowance, runtimeAllowedModelSet, runtimeTaskIsBillable } from './approvalReviewer.ts';
import { assertManagedKeyCanUseModelSet, createModelSetGuardrail,
  exactModelSetGuardrailMatches } from './openrouterManagement.ts';
import { decideRuntimeSettlement } from './runtimeSettlement.ts';

const reviewer = { id: 'openai/gpt-5.4-mini-2026', provider_route_id: BLUE_APPROVAL_REVIEWER_MODEL,
  supported_parameters: ['tools', 'response_format', 'structured_outputs', 'reasoning', 'reasoning_effort'],
  pricing: { prompt: '0.00000075', completion: '0.0000045' } };

test('reviewer is optional and exactly allowlisted; no implicit paid fallback', () => {
  for (const value of [undefined, null, '']) assert.equal(normalizeApprovalReviewer(value), undefined);
  assert.equal(normalizeApprovalReviewer(BLUE_APPROVAL_REVIEWER_MODEL), BLUE_APPROVAL_REVIEWER_MODEL);
  for (const value of [true, 1, 'openrouter/auto', 'openai/gpt-5-mini', `${BLUE_APPROVAL_REVIEWER_MODEL}:free`]) {
    assert.throws(() => normalizeApprovalReviewer(value), /not supported/);
  }
  assert.equal(approvalReviewerFromCatalog([reviewer], BLUE_APPROVAL_REVIEWER_MODEL), reviewer);
  assert.throws(() => approvalReviewerFromCatalog([], BLUE_APPROVAL_REVIEWER_MODEL), /unavailable/);
  assert.throws(() => approvalReviewerFromCatalog([{ ...reviewer, supported_parameters: ['tools', 'response_format'] }], BLUE_APPROVAL_REVIEWER_MODEL), /capabilities/);
  assert.throws(() => approvalReviewerFromCatalog([{ ...reviewer, pricing: { prompt: '-1', completion: '1' } }], BLUE_APPROVAL_REVIEWER_MODEL), /pricing/);
});

test('free coding stays free identity while explicit paid review makes the task billable', () => {
  assert.equal(runtimeTaskIsBillable({ is_free: true }), false);
  assert.equal(runtimeTaskIsBillable({ is_free: false }), true);
  assert.equal(runtimeTaskIsBillable({ is_free: true, reviewer_model: BLUE_APPROVAL_REVIEWER_MODEL }), true);
  assert.deepEqual(runtimeAllowedModelSet('vendor/model:free', BLUE_APPROVAL_REVIEWER_MODEL), [BLUE_APPROVAL_REVIEWER_MODEL, 'vendor/model:free']);
  assert.deepEqual(runtimeAllowedModelSet(BLUE_APPROVAL_REVIEWER_MODEL, BLUE_APPROVAL_REVIEWER_MODEL), [BLUE_APPROVAL_REVIEWER_MODEL]);
  const cost = decideRuntimeSettlement({ requestedAt: 0, now: 130_000, credentials: [{
    keyHash: 'task-key', state: 'disabled', usageStart: 0.001, usageObserved: 0.008,
    stableObservations: 2
  }] });
  assert.equal(cost.ready, true);
  assert.equal(cost.providerCost, 0.007, 'one managed key includes every coding and review generation');
});

test('low-balance retry restores only its immutable existing reviewed allowance', () => {
  const identity = { device_hash: 'a'.repeat(64), payload_hash: 'b'.repeat(64),
    model: 'vendor/coding:free', mode: 'normal', is_free: true, reviewer_model: BLUE_APPROVAL_REVIEWER_MODEL };
  const task = { ...identity, requested_blue_credits: '0.2' };
  assert.equal(reviewedRuntimeReplayAllowance(task, identity), 0.2);
  for (const changed of [{ device_hash: 'other' }, { payload_hash: 'other' }, { model: 'vendor/paid' },
    { mode: 'ui_max' }, { is_free: false }, { reviewer_model: null }, { reviewer_model: 'other/model' }]) {
    assert.throws(() => reviewedRuntimeReplayAllowance(task, { ...identity, ...changed }), /different runtime settings/);
  }
  for (const invalid of [0, -1, 'NaN', Infinity]) {
    assert.throws(() => reviewedRuntimeReplayAllowance({ ...task, requested_blue_credits: invalid }, identity), /invalid runtime allowance/);
  }
});

test('two-model guardrails require exact workspace and set, never unrestricted or expanded', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENROUTER_MANAGEMENT_API_KEY;
  const previousWorkspace = process.env.OPENROUTER_WORKSPACE_ID;
  process.env.OPENROUTER_MANAGEMENT_API_KEY = 'test-management-key';
  process.env.OPENROUTER_WORKSPACE_ID = 'test-workspace';
  const expected = ['openai/gpt-5.4-mini', 'vendor/model:free'];
  let policy = { workspace_id: 'test-workspace', allowed_models: expected };
  let created;
  globalThis.fetch = async (_url, init = {}) => {
    if (init.method === 'POST') { created = JSON.parse(init.body); return Response.json({ data: { id: 'bounded-policy' } }); }
    return Response.json({ data: policy });
  };
  try {
    assert.equal(await createModelSetGuardrail([...expected].reverse()), 'bounded-policy');
    assert.deepEqual(created.allowed_models, expected);
    assert.equal(created.workspace_id, 'test-workspace');
    assert.equal(await exactModelSetGuardrailMatches('bounded-policy', expected), true);
    for (const allowed_models of [null, [], [expected[0]], [...expected, 'vendor/extra'], [expected[0], expected[0]]]) {
      policy = { workspace_id: 'test-workspace', allowed_models };
      assert.equal(await exactModelSetGuardrailMatches('bounded-policy', expected), false);
    }
    policy = { workspace_id: 'other-workspace', allowed_models: expected };
    assert.equal(await exactModelSetGuardrailMatches('bounded-policy', expected), false);
    await assert.rejects(createModelSetGuardrail([...expected, 'vendor/extra']), /one or two/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENROUTER_MANAGEMENT_API_KEY; else process.env.OPENROUTER_MANAGEMENT_API_KEY = previousKey;
    if (previousWorkspace === undefined) delete process.env.OPENROUTER_WORKSPACE_ID; else process.env.OPENROUTER_WORKSPACE_ID = previousWorkspace;
  }
});

test('key-filtered catalogue must expose exactly coding+reviewer, retaining route variants', async () => {
  const previousFetch = globalThis.fetch;
  const selected = [{ model: 'vendor/coding:free', aliases: ['vendor/coding-2026:free'] }, { model: BLUE_APPROVAL_REVIEWER_MODEL }];
  let routes = ['vendor/coding:free', BLUE_APPROVAL_REVIEWER_MODEL];
  globalThis.fetch = async (_url, init) => {
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer test-child');
    return Response.json({ data: routes.map(id => ({ id })) });
  };
  try {
    await assertManagedKeyCanUseModelSet('test-child', selected);
    routes = ['vendor/coding-2026:free', BLUE_APPROVAL_REVIEWER_MODEL];
    await assertManagedKeyCanUseModelSet('test-child', selected);
    for (const invalid of [
      ['vendor/coding:free'],
      ['vendor/coding:free', BLUE_APPROVAL_REVIEWER_MODEL, 'vendor/unrelated'],
      ['vendor/coding', BLUE_APPROVAL_REVIEWER_MODEL],
      ['vendor/coding:free', 'vendor/coding-2026:free', BLUE_APPROVAL_REVIEWER_MODEL]
    ]) {
      routes = invalid;
      await assert.rejects(assertManagedKeyCanUseModelSet('test-child', selected), /cannot access|not restricted/);
    }
  } finally { globalThis.fetch = previousFetch; }
});

test('runtime keeps old hash/v2 when absent and accounts for reviewer costs without blocking free coding', async () => {
  const runtime = await readFile(new URL('./blueRuntime.ts', import.meta.url), 'utf8');
  const route = await readFile(new URL('../app/api/runtime/v1/tasks/route.ts', import.meta.url), 'utf8');
  assert.match(route, /approvalReviewerModel: body\.approval_reviewer_model/);
  assert.match(runtime, /reviewerModel \? 'admit_blue_runtime_task_v3' : 'admit_blue_runtime_task_v2'/);
  assert.match(runtime, /\.\.\.\(reviewerModel \? \{ approvalReviewerModel: reviewerModel \} : \{\}\)/);
  assert.match(runtime, /runtimeTaskIsBillable\(task\) \? providerCost : 0/);
  assert.match(runtime, /if \(!runtimeTaskIsBillable\(task\) && providerCost > 0\)/);
  assert.match(runtime, /if \(!runtimeTaskIsBillable\(task\)\) \{/);
  assert.match(runtime, /approval_reviewer_model: reviewerRoute/);
  assert.match(runtime, /approval_reviewer: \{/);
  assert.match(runtime, /await assertManagedKeyCanUseModelSet\(created\.key/);
  assert.match(runtime, /approval-model-set:/, 'never widen an existing single-model guardrail');
});
