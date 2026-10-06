import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { approvalReviewerFromCatalog, BLUE_APPROVAL_REVIEWER_MODEL, normalizeApprovalReviewer,
  reviewedRuntimeReplayAllowance, runtimeAllowedModelSet, runtimeTaskIsBillable } from './approvalReviewer.ts';
import { assertManagedKeyCanUseModelSet, createModelSetGuardrail,
  exactModelSetGuardrailMatches } from './openrouterManagement.ts';
import { modelsForAccess, normalizeOpenRouterModels, providerModelId } from './openrouter.ts';
import { decideRuntimeSettlement } from './runtimeSettlement.ts';

const legacyReviewerModel = 'openai/gpt-5.4-mini';
const reviewer = { id: 'qwen/qwen3.8-27b-2026:free', provider_route_id: BLUE_APPROVAL_REVIEWER_MODEL,
  supported_parameters: ['structured_outputs', 'reasoning', 'reasoning_effort'],
  pricing: { prompt: '0', completion: '0' } };
const legacyReviewer = { id: 'openai/gpt-5.4-mini-2026', provider_route_id: legacyReviewerModel,
  supported_parameters: ['tools', 'response_format', 'structured_outputs', 'reasoning', 'reasoning_effort'],
  pricing: { prompt: '0.00000075', completion: '0.0000045' } };

test('free reviewer and legacy paid reviewer are exactly allowlisted without fallback or meta-routers', () => {
  assert.equal(BLUE_APPROVAL_REVIEWER_MODEL, 'qwen/qwen3.8-27b:free');
  for (const value of [undefined, null, '']) assert.equal(normalizeApprovalReviewer(value), undefined);
  assert.equal(normalizeApprovalReviewer(BLUE_APPROVAL_REVIEWER_MODEL), BLUE_APPROVAL_REVIEWER_MODEL);
  assert.equal(normalizeApprovalReviewer(legacyReviewerModel), legacyReviewerModel);
  for (const value of [true, 1, {}, [], 'openrouter/auto', 'openrouter/free', 'openai/gpt-5-mini',
    'qwen/qwen3.8-27b', 'qwen/qwen3.8-27b:batch', `${BLUE_APPROVAL_REVIEWER_MODEL}:free`,
    ` ${BLUE_APPROVAL_REVIEWER_MODEL}`, `${BLUE_APPROVAL_REVIEWER_MODEL} `]) {
    assert.throws(() => normalizeApprovalReviewer(value), /not supported/);
    assert.throws(() => approvalReviewerFromCatalog([reviewer, legacyReviewer], value), /not supported/);
  }
  assert.equal(approvalReviewerFromCatalog([reviewer], BLUE_APPROVAL_REVIEWER_MODEL), reviewer);
  assert.equal(approvalReviewerFromCatalog([legacyReviewer], legacyReviewerModel), legacyReviewer);
  assert.throws(() => approvalReviewerFromCatalog([], BLUE_APPROVAL_REVIEWER_MODEL), /unavailable/);
  assert.throws(() => approvalReviewerFromCatalog([legacyReviewer], BLUE_APPROVAL_REVIEWER_MODEL), /unavailable/,
    'an unavailable free reviewer must never silently use the legacy paid reviewer');
  assert.throws(() => approvalReviewerFromCatalog([{
    ...reviewer, provider_route_id: 'qwen/qwen3.8-27b', aliases: [BLUE_APPROVAL_REVIEWER_MODEL]
  }], BLUE_APPROVAL_REVIEWER_MODEL), /unavailable/,
    'a paid route cannot satisfy the free reviewer through a canonical ID or alias');
});

test('free review requires native structured output and reasoning but does not require coding tools', () => {
  assert.equal(approvalReviewerFromCatalog([reviewer], BLUE_APPROVAL_REVIEWER_MODEL), reviewer,
    'structured output can be advertised without tools or response_format');
  for (const parameter of reviewer.supported_parameters) {
    assert.throws(() => approvalReviewerFromCatalog([{
      ...reviewer, supported_parameters: reviewer.supported_parameters.filter(value => value !== parameter)
    }], BLUE_APPROVAL_REVIEWER_MODEL), /capabilities/, `missing ${parameter} must fail closed`);
  }
  assert.throws(() => approvalReviewerFromCatalog([{
    ...reviewer, supported_parameters: ['tools', 'response_format']
  }], BLUE_APPROVAL_REVIEWER_MODEL), /capabilities/);
  for (const parameter of ['tools', 'response_format']) {
    assert.throws(() => approvalReviewerFromCatalog([{
      ...legacyReviewer, supported_parameters: legacyReviewer.supported_parameters.filter(value => value !== parameter)
    }], legacyReviewerModel), /capabilities/, 'legacy paid review retains its original capability requirements');
  }
});

test('free reviewer pricing requires explicit exact-zero token prices and rejects malformed prices', () => {
  for (const field of ['prompt', 'completion']) {
    for (const value of [undefined, null, '', ' ', 0, true, false, [], {}, '-1', '-0.000001',
      '0.000001', '1e-100', 'NaN', 'Infinity', Infinity, NaN]) {
      assert.throws(() => approvalReviewerFromCatalog([{
        ...reviewer, pricing: { ...reviewer.pricing, [field]: value }
      }], BLUE_APPROVAL_REVIEWER_MODEL), /pricing/, `${field}=${String(value)} cannot prove a free route`);
    }
  }
  assert.throws(() => approvalReviewerFromCatalog([{ ...reviewer, pricing: undefined }], BLUE_APPROVAL_REVIEWER_MODEL), /pricing/);
  for (const zero of ['0', '0.000000', '0e0']) {
    assert.equal(approvalReviewerFromCatalog([{
      ...reviewer, pricing: { prompt: zero, completion: zero }
    }], BLUE_APPROVAL_REVIEWER_MODEL).pricing.prompt, zero);
  }
  assert.throws(() => approvalReviewerFromCatalog([{
    ...legacyReviewer, pricing: { prompt: '-1', completion: '1' }
  }], legacyReviewerModel), /pricing/);
  assert.throws(() => approvalReviewerFromCatalog([{
    ...legacyReviewer, pricing: { prompt: '0', completion: '0' }
  }], legacyReviewerModel), /pricing/, 'legacy paid review must retain a verified positive completion price');
});

test('every exposed auxiliary reviewer fee must be verified zero, including future provider fees', () => {
  for (const field of ['request', 'image', 'web_search', 'internal_reasoning', 'input_cache_read',
    'input_cache_write', 'output_cache_read', 'provider_auxiliary_fee']) {
    const zeroPricing = { ...reviewer.pricing, [field]: '0' };
    assert.equal(approvalReviewerFromCatalog([{ ...reviewer, pricing: zeroPricing }], BLUE_APPROVAL_REVIEWER_MODEL).pricing[field], '0');
    for (const value of ['0.000001', '-1', 'NaN', 'Infinity', Infinity, null, '', ' ', true, false, [], {}]) {
      assert.throws(() => approvalReviewerFromCatalog([{
        ...reviewer, pricing: { ...zeroPricing, [field]: value }
      }], BLUE_APPROVAL_REVIEWER_MODEL), /pricing/, `${field}=${String(value)} cannot prove an entirely free review`);
    }
  }
});

test('normalization retains the exact structured-only free reviewer without exposing it as a coding model', () => {
  const rawReviewer = { ...reviewer, id: BLUE_APPROVAL_REVIEWER_MODEL,
    canonical_slug: 'qwen/qwen3.8-27b-2026' };
  const coding = { id: 'vendor/coding:free', supported_parameters: ['tools'],
    pricing: { prompt: '0', completion: '0' } };
  const unrelated = { id: 'vendor/structured-only:free', supported_parameters: reviewer.supported_parameters,
    pricing: reviewer.pricing };
  const models = normalizeOpenRouterModels([coding, rawReviewer, unrelated]);
  const normalizedReviewer = approvalReviewerFromCatalog(models, BLUE_APPROVAL_REVIEWER_MODEL);
  assert.equal(providerModelId(normalizedReviewer), BLUE_APPROVAL_REVIEWER_MODEL);
  assert.deepEqual(modelsForAccess(models, 'full').map(providerModelId), ['vendor/coding:free']);
  assert.deepEqual(modelsForAccess(models, 'trial').map(providerModelId), ['vendor/coding:free']);
  assert.ok(!models.some(model => providerModelId(model) === unrelated.id),
    'allowing reviewer metadata must not broaden the structured-only catalogue exception');
});

test('free coding with free review remains nonbillable while paid coding or legacy paid review stays billable', () => {
  assert.equal(runtimeTaskIsBillable({ is_free: true }), false);
  assert.equal(runtimeTaskIsBillable({ is_free: true, reviewer_model: null }), false);
  assert.equal(runtimeTaskIsBillable({ is_free: false }), true);
  assert.equal(runtimeTaskIsBillable({ is_free: true, reviewer_model: BLUE_APPROVAL_REVIEWER_MODEL }), false);
  assert.equal(runtimeTaskIsBillable({ is_free: false, reviewer_model: BLUE_APPROVAL_REVIEWER_MODEL }), true);
  assert.equal(runtimeTaskIsBillable({ is_free: true, reviewer_model: legacyReviewerModel }), true);
  assert.equal(runtimeTaskIsBillable({ is_free: false, reviewer_model: legacyReviewerModel }), true);
  assert.equal(runtimeTaskIsBillable({ is_free: true, reviewer_model: 'vendor/unknown:free' }), true,
    'an unverified persisted reviewer must never be classified as free');
  assert.deepEqual(runtimeAllowedModelSet('vendor/model:free', BLUE_APPROVAL_REVIEWER_MODEL), [BLUE_APPROVAL_REVIEWER_MODEL, 'vendor/model:free']);
  assert.deepEqual(runtimeAllowedModelSet(BLUE_APPROVAL_REVIEWER_MODEL, BLUE_APPROVAL_REVIEWER_MODEL), [BLUE_APPROVAL_REVIEWER_MODEL]);
  assert.deepEqual(runtimeAllowedModelSet('vendor/model:free'), ['vendor/model:free']);
  const cost = decideRuntimeSettlement({ requestedAt: 0, now: 130_000, credentials: [{
    keyHash: 'task-key', state: 'disabled', usageStart: 0.001, usageObserved: 0.008,
    stableObservations: 2
  }] });
  assert.equal(cost.ready, true);
  assert.equal(cost.providerCost, 0.007, 'one managed key includes every coding and review generation');
});

test('low-balance retry restores only its immutable existing legacy paid reviewed allowance', () => {
  const identity = { device_hash: 'a'.repeat(64), payload_hash: 'b'.repeat(64),
    model: 'vendor/coding:free', mode: 'normal', is_free: true, reviewer_model: legacyReviewerModel };
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

test('free reviewed retries preserve zero allowance and cannot change immutable runtime settings', () => {
  const identity = { device_hash: 'a'.repeat(64), payload_hash: 'b'.repeat(64),
    model: 'vendor/coding:free', mode: 'normal', is_free: true, reviewer_model: BLUE_APPROVAL_REVIEWER_MODEL };
  for (const requested_blue_credits of [0, '0']) {
    const task = { ...identity, requested_blue_credits };
    assert.equal(reviewedRuntimeReplayAllowance(task, identity), 0);
    assert.equal(reviewedRuntimeReplayAllowance(task, identity), 0, 'repeated replay cannot create an allowance');
    for (const changed of [{ device_hash: 'other' }, { payload_hash: 'other' }, { model: 'vendor/paid' },
      { mode: 'ui_max' }, { is_free: false }, { reviewer_model: null }, { reviewer_model: legacyReviewerModel }]) {
      assert.throws(() => reviewedRuntimeReplayAllowance(task, { ...identity, ...changed }), /different runtime settings/);
    }
  }
  for (const invalid of [-1, 0.2, '0.2', 'NaN', Infinity]) {
    assert.throws(() => reviewedRuntimeReplayAllowance({ ...identity, requested_blue_credits: invalid }, identity), /invalid runtime allowance/);
  }
  const paidCoding = { ...identity, model: 'vendor/paid', is_free: false };
  assert.equal(reviewedRuntimeReplayAllowance({ ...paidCoding, requested_blue_credits: '0.2' }, paidCoding), 0.2);
  assert.throws(() => reviewedRuntimeReplayAllowance({ ...paidCoding, requested_blue_credits: 0 }, paidCoding), /invalid runtime allowance/);
});

test('two-model guardrails require exact workspace and set, never unrestricted or expanded', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENROUTER_MANAGEMENT_API_KEY;
  const previousWorkspace = process.env.OPENROUTER_WORKSPACE_ID;
  process.env.OPENROUTER_MANAGEMENT_API_KEY = 'test-management-key';
  process.env.OPENROUTER_WORKSPACE_ID = 'test-workspace';
  const expected = [BLUE_APPROVAL_REVIEWER_MODEL, 'vendor/model:free'];
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
    for (const router of ['openrouter/auto', 'openrouter/free']) {
      await assert.rejects(createModelSetGuardrail(['vendor/model:free', router]), /canonical model identifier/);
    }
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
      ['vendor/coding:free', legacyReviewerModel],
      ['vendor/coding:free', 'qwen/qwen3.8-27b'],
      ['vendor/coding:free', 'openrouter/free'],
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

test('whole-task-free reviewed extensions return a credential before any paid extension RPC', async () => {
  const runtime = await readFile(new URL('./blueRuntime.ts', import.meta.url), 'utf8');
  const extension = runtime.slice(runtime.indexOf('export async function extendBlueRuntimeTask('),
    runtime.indexOf('export async function completeBlueRuntimeTask('));
  const freeBranch = extension.indexOf('if (!runtimeTaskIsBillable(task))');
  const paidRpc = extension.indexOf(".rpc('extend_blue_runtime_task'");
  assert.ok(freeBranch >= 0 && paidRpc > freeBranch);
  assert.match(extension.slice(freeBranch, paidRpc), /const credential = await activeOrProvision\(task\)/);
  assert.match(extension.slice(freeBranch, paidRpc), /return admissionPayload\(task, credential,/,
    'the free-review billing classification must exit before any wallet extension');
});
