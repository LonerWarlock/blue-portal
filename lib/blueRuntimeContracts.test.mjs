import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decryptRuntimeSecret, encryptRuntimeSecret } from './blueRuntimeCrypto.ts';
import { modelsForAccess, normalizeOpenRouterModels, publicModel, resolveModel } from './openrouter.ts';
import {
  decideRuntimeSettlement,
  nextStableUsageObservation
} from './runtimeSettlement.ts';
import {
  assertManagedKeyCanUseModel,
  assignKeyGuardrail,
  createManagedKey,
  createModelGuardrail,
  exactModelGuardrailMatches,
  getManagedKey,
  updateManagedKey
} from './openrouterManagement.ts';

test('runtime credentials use authenticated AES-256-GCM encryption and task-bound AAD', () => {
  const previous = process.env.BLUE_RUNTIME_TOKEN_ENCRYPTION_KEY;
  process.env.BLUE_RUNTIME_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  try {
    const encrypted = encryptRuntimeSecret('sk-or-v1-runtime-secret', 'blue-runtime:task:credential');
    assert.notEqual(encrypted.encryptedKey, 'sk-or-v1-runtime-secret');
    assert.equal(
      decryptRuntimeSecret(encrypted, 'blue-runtime:task:credential'),
      'sk-or-v1-runtime-secret'
    );
    assert.throws(() => decryptRuntimeSecret(encrypted, 'blue-runtime:other:credential'));
  } finally {
    if (previous === undefined) delete process.env.BLUE_RUNTIME_TOKEN_ENCRYPTION_KEY;
    else process.env.BLUE_RUNTIME_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test('management credentials only call key and exact-model guardrail endpoints', async () => {
  const previousKey = process.env.OPENROUTER_MANAGEMENT_API_KEY;
  const previousWorkspace = process.env.OPENROUTER_WORKSPACE_ID;
  const previousFetch = globalThis.fetch;
  process.env.OPENROUTER_MANAGEMENT_API_KEY = 'management-only-secret';
  process.env.OPENROUTER_WORKSPACE_ID = '0df9e665-d932-5740-b2c7-b52af166bc11';
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === 'https://openrouter.ai/api/v1/keys' && init.method === 'POST') {
      return Response.json({
        key: 'sk-or-v1-child',
        data: { hash: 'child-hash', usage: 0, limit: 0.1, limit_remaining: 0.1, disabled: false, expires_at: null }
      });
    }
    if (String(url).endsWith('/keys/child-hash') && !init.method) {
      return Response.json({ data: { hash: 'child-hash', usage: 0.02, limit: 0.1, disabled: false } });
    }
    if (String(url).endsWith('/keys/child-hash') && init.method === 'PATCH') {
      return Response.json({ data: { hash: 'child-hash', usage: 0.02, limit: 0.1, disabled: true } });
    }
    if (String(url).endsWith('/guardrails') && init.method === 'POST') {
      return Response.json({ data: { id: 'guardrail-id' } });
    }
    if (String(url).endsWith('/guardrails/guardrail-id') && !init.method) {
      return Response.json({ data: {
        id: 'guardrail-id',
        workspace_id: process.env.OPENROUTER_WORKSPACE_ID,
        allowed_models: ['deepseek/deepseek-v4-flash']
      } });
    }
    if (String(url).endsWith('/guardrails/guardrail-id/assignments/keys')) {
      return Response.json({ assigned_count: 1 });
    }
    if (String(url).endsWith('/models/user')) {
      return Response.json({
        data: [{ id: 'deepseek/deepseek-v4-flash', canonical_slug: 'deepseek/deepseek-v4-flash' }]
      });
    }
    throw new Error(`Unexpected management URL: ${url}`);
  };
  try {
    await createManagedKey({
      name: 'Blue test',
      limit: 0.1,
      expiresAt: '2027-01-01T00:00:00.000Z'
    });
    await getManagedKey('child-hash');
    await updateManagedKey('child-hash', { disabled: true });
    const guardrailId = await createModelGuardrail('deepseek/deepseek-v4-flash');
    assert.equal(await exactModelGuardrailMatches(guardrailId, 'deepseek/deepseek-v4-flash'), true);
    await assignKeyGuardrail(guardrailId, 'child-hash');
    await assertManagedKeyCanUseModel('sk-or-v1-child', 'deepseek/deepseek-v4-flash');
    await assert.rejects(
      createModelGuardrail('~deepseek/deepseek-v4-flash-latest'),
      /canonical model identifier/
    );
    await assert.rejects(
      createModelGuardrail('openrouter/free'),
      /canonical model identifier/
    );

    assert.equal(calls.some(call => call.url.includes('/chat/completions')), false);
    const managementCalls = calls.filter(call => !call.url.endsWith('/models/user'));
    assert.ok(managementCalls.every(call =>
      new Headers(call.init.headers).get('authorization') === 'Bearer management-only-secret'
    ));
    assert.equal(
      new Headers(calls.find(call => call.url.endsWith('/models/user')).init.headers).get('authorization'),
      'Bearer sk-or-v1-child'
    );
    const keyBody = JSON.parse(calls.find(call => call.url === 'https://openrouter.ai/api/v1/keys').init.body);
    assert.equal(keyBody.limit, 0.1);
    assert.equal(keyBody.expires_at, '2027-01-01T00:00:00.000Z');
    assert.equal(keyBody.workspace_id, process.env.OPENROUTER_WORKSPACE_ID);
    const guardrailBody = JSON.parse(calls.find(call => call.url.endsWith('/guardrails')).init.body);
    assert.deepEqual(guardrailBody.allowed_models, ['deepseek/deepseek-v4-flash']);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENROUTER_MANAGEMENT_API_KEY;
    else process.env.OPENROUTER_MANAGEMENT_API_KEY = previousKey;
    if (previousWorkspace === undefined) delete process.env.OPENROUTER_WORKSPACE_ID;
    else process.env.OPENROUTER_WORKSPACE_ID = previousWorkspace;
  }
});

test('catalogue aliases resolve to permanent model slugs and never reach public or guardrail payloads', () => {
  const models = normalizeOpenRouterModels([{
    id: '~deepseek/deepseek-v4-flash-latest',
    canonical_slug: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    pricing: { prompt: '0', completion: '0' },
    supported_parameters: ['tools']
  }]);

  assert.equal(models.length, 1);
  assert.equal(models[0].id, 'deepseek/deepseek-v4-flash');
  assert.deepEqual(models[0].aliases, ['~deepseek/deepseek-v4-flash-latest']);
  assert.equal(
    resolveModel(models, '~deepseek/deepseek-v4-flash-latest')?.id,
    'deepseek/deepseek-v4-flash'
  );
  assert.equal(publicModel(models[0]).id, 'deepseek/deepseek-v4-flash');
});

test('child-key verification rejects a credential that can see another model', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: [
    { id: 'vendor/selected', canonical_slug: 'vendor/selected' },
    { id: 'vendor/other-paid', canonical_slug: 'vendor/other-paid' }
  ] });
  try {
    await assert.rejects(
      assertManagedKeyCanUseModel('child-key', 'vendor/selected'),
      /not restricted to the selected model/
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('child-key verification accepts the one public alias of a canonical model', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: [
    { id: 'vendor/model-public-slug' }
  ] });
  try {
    await assert.doesNotReject(
      assertManagedKeyCanUseModel(
        'child-key',
        'vendor/model-20260907',
        ['vendor/model-public-slug']
      )
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Blue removes provider meta-routers and never treats variable pricing as free', () => {
  const models = normalizeOpenRouterModels([{
    id: 'openrouter/free',
    canonical_slug: 'openrouter/free',
    pricing: { prompt: '0', completion: '0' },
    supported_parameters: ['tools']
  }, {
    id: 'openrouter/auto',
    canonical_slug: 'openrouter/auto',
    pricing: { prompt: '-1', completion: '-1' },
    supported_parameters: ['tools']
  }, {
    id: 'vendor/concrete-free',
    canonical_slug: 'vendor/concrete-free-20260907',
    pricing: { prompt: '0', completion: '0' },
    supported_parameters: ['tools']
  }, {
    id: 'vendor/variable-router',
    canonical_slug: 'vendor/variable-router-20260907',
    pricing: { prompt: '-1', completion: '-1' },
    supported_parameters: ['tools']
  }]);

  assert.deepEqual(models.map(model => model.id), [
    'vendor/concrete-free-20260907',
    'vendor/variable-router-20260907'
  ]);
  assert.equal(publicModel(models[0]).isFree, true);
  assert.equal(publicModel(models[1]).isFree, false);
  assert.deepEqual(modelsForAccess(models, 'trial').map(model => model.id), [
    'vendor/concrete-free-20260907'
  ]);
});

test('a paid permanent catalogue row wins over an earlier free alias', () => {
  const models = normalizeOpenRouterModels([{
    id: '~vendor/model-latest',
    canonical_slug: 'vendor/model-20260907',
    pricing: { prompt: '0', completion: '0' },
    supported_parameters: ['tools']
  }, {
    id: 'vendor/model',
    canonical_slug: 'vendor/model-20260907',
    pricing: { prompt: '0.000001', completion: '0.000002' },
    supported_parameters: ['tools']
  }]);
  assert.equal(models.length, 1);
  assert.equal(publicModel(models[0]).isFree, false);
  assert.deepEqual(modelsForAccess(models, 'trial'), []);
});

test('runtime verifies exact child-key model access after assigning its guardrail', async () => {
  const runtime = await readFile(new URL('./blueRuntime.ts', import.meta.url), 'utf8');
  const assignment = runtime.indexOf('await assignKeyGuardrail(guardrailId, keyHash)');
  const verification = runtime.indexOf('await assertManagedKeyCanUseModel(created.key, providerModel.id, providerModel.aliases)');
  const activation = runtime.indexOf("state: 'active'");
  assert.ok(assignment >= 0 && verification > assignment && activation > verification);
  const reservationExtension = runtime.indexOf(".from('billing_reservations')", verification);
  assert.ok(reservationExtension > verification && activation > reservationExtension);
});

test('runtime migration enforces idempotency, concurrency, encrypted replay, and safe legacy cleanup', async () => {
  const migration = await readFile(new URL('../supabase/migrations/010_blue_direct_runtime.sql', import.meta.url), 'utf8');
  assert.match(migration, /create table if not exists public\.blue_runtime_tasks/);
  assert.match(migration, /create table if not exists public\.blue_runtime_credentials/);
  assert.match(migration, /create table if not exists public\.blue_model_guardrails/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /blue_runtime_credentials_one_live_idx/);
  assert.match(migration, /create table if not exists public\.blue_runtime_extensions/);
  assert.match(migration, /primary key \(request_id, extension_id\)/);
  assert.match(migration, /'duplicate', true/);
  assert.match(migration, /where state in \('provisioning', 'active'\)/);
  assert.match(migration, /concurrency_limit_param/);
  assert.match(migration, /device_hash <> device_hash_param/);
  assert.match(migration, /payload_hash <> payload_hash_param/);
  assert.match(migration, /release_expired_blue_credit_reservations/);
  assert.match(migration, /not exists \(\s*select 1 from public\.blue_runtime_tasks/s);
  assert.match(migration, /drop table if exists public\.blue_gateway_requests/);
  assert.doesNotMatch(migration, /qstash/i);
});

test('runtime admission repair reuses orphan reservations without charging twice', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/011_blue_runtime_admission_repair.sql', import.meta.url),
    'utf8'
  );
  assert.match(migration, /reservation_record\.status <> 'pending'/);
  assert.match(migration, /effective_reservation := reservation_record\.reserved_blue_credits/);
  assert.match(migration, /recovered_orphan := true/);
  assert.match(migration, /insert into public\.blue_runtime_tasks/);
  assert.match(migration, /'recovered', recovered_orphan/);
  assert.doesNotMatch(migration, /update public\.wallets/);
});

test('active direct tasks heartbeat and only stale tasks are reclaimed before admission', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/015_blue_runtime_heartbeat.sql', import.meta.url),
    'utf8'
  );
  const runtime = await readFile(new URL('./blueRuntime.ts', import.meta.url), 'utf8');
  const heartbeatRoute = await readFile(
    new URL('../app/api/runtime/v1/tasks/[requestId]/heartbeat/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(migration, /add column if not exists last_heartbeat_at/i);
  assert.match(migration, /where state in \('provisioning', 'active'\)/i);
  assert.match(runtime, /BLUE_RUNTIME_HEARTBEAT_STALE_MS/);
  assert.match(runtime, /\.select\('\*'\)/);
  assert.match(runtime, /last_heartbeat_at \|\| activeTask\.updated_at/);
  assert.match(runtime, /heartbeatBlueRuntimeTask/);
  assert.match(heartbeatRoute, /authenticateBlueKey/);
  assert.match(heartbeatRoute, /heartbeatBlueRuntimeTask/);
});

test('legacy gateway Stop is durable, process-scoped, and checked before billing or upstream work', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/014_gateway_client_stop.sql', import.meta.url),
    'utf8'
  );
  const completionRoute = await readFile(
    new URL('../app/api/chat/completions/route.ts', import.meta.url),
    'utf8'
  );
  const stopRoute = await readFile(
    new URL('../app/api/chat/requests/cancel-active/route.ts', import.meta.url),
    'utf8'
  );
  const cancellation = await readFile(
    new URL('./blueRequestCancellation.ts', import.meta.url),
    'utf8'
  );
  const billing = await readFile(new URL('./bluePayg.ts', import.meta.url), 'utf8');

  assert.match(migration, /blue_gateway_client_requests/);
  assert.match(migration, /blue_gateway_client_cancellations/);
  assert.match(migration, /cancel_blue_gateway_client_requests/);
  assert.match(migration, /reservation\.status = 'pending'/);
  assert.match(stopRoute, /requestBlueGatewayClientCancellation/);
  assert.match(stopRoute, /X-Blue-Client-Instance|x-blue-client-instance/i);
  assert.match(cancellation, /Durable client Stop schema is not available yet/);
  assert.match(cancellation, /localCancelledCount/);
  assert.match(billing, /decisionExplicit/);
  assert.match(completionRoute, /legacyFreshReservation/);
  assert.doesNotMatch(completionRoute, /type:\s*['"]blue\.usage['"]/);
  assert.match(completionRoute, /object:\s*['"]chat\.completion\.chunk['"]/);
  assert.match(completionRoute, /choices:\s*\[\]/);
  assert.match(completionRoute, /route:\s*['"]blue['"]/);
  assert.doesNotMatch(completionRoute, /route:\s*['"]openrouter['"]/i);
  assert.ok(
    completionRoute.indexOf('isBlueGatewayClientCancellationRequested(account, clientInstanceId)') <
    completionRoute.indexOf('reserveUsage(account, requestId'),
    'client Stop marker must be checked before a credit reservation'
  );
  assert.ok(
    completionRoute.indexOf('registerBlueGatewayClientRequest') <
    completionRoute.indexOf("fetch('https://openrouter.ai/api/v1/chat/completions'"),
    'the durable client mapping must exist before upstream execution'
  );
});

test('paid runtime usage waits for two separated authoritative observations before settlement', () => {
  const first = nextStableUsageObservation({
    previousUsage: null,
    previousStableObservations: 0,
    previousObservedAt: null,
    observedUsage: 0.08,
    now: 1_000
  });
  const tooSoon = nextStableUsageObservation({
    previousUsage: first.usage,
    previousStableObservations: first.stableObservations,
    previousObservedAt: 1_000,
    observedUsage: 0.08,
    now: 2_000,
    minimumIntervalMs: 5_000
  });
  const stable = nextStableUsageObservation({
    previousUsage: tooSoon.usage,
    previousStableObservations: tooSoon.stableObservations,
    previousObservedAt: 1_000,
    observedUsage: 0.08,
    now: 7_000,
    minimumIntervalMs: 5_000
  });
  assert.equal(first.stableObservations, 1);
  assert.equal(tooSoon.stableObservations, 1);
  assert.equal(stable.stableObservations, 2);

  const decision = decideRuntimeSettlement({
    requestedAt: 0,
    now: 31_000,
    usageGraceMs: 30_000,
    zeroUsageGraceMs: 120_000,
    credentials: [{
      keyHash: 'child-hash',
      state: 'disabled',
      usageStart: 0,
      usageObserved: stable.usage,
      stableObservations: stable.stableObservations
    }]
  });
  assert.equal(decision.ready, true);
  assert.equal(decision.providerCost, 0.08);
});

test('zero reported paid usage remains reserved through the delayed-usage grace period', () => {
  const pending = decideRuntimeSettlement({
    requestedAt: 0,
    now: 60_000,
    usageGraceMs: 30_000,
    zeroUsageGraceMs: 120_000,
    credentials: [{
      keyHash: 'child-hash',
      state: 'disabled',
      usageStart: 0,
      usageObserved: 0,
      stableObservations: 3
    }]
  });
  assert.equal(pending.ready, false);
  assert.equal(pending.reason, 'usage-grace');

  const ready = decideRuntimeSettlement({
    requestedAt: 0,
    now: 121_000,
    usageGraceMs: 30_000,
    zeroUsageGraceMs: 120_000,
    credentials: [{
      keyHash: 'child-hash',
      state: 'disabled',
      usageStart: 0,
      usageObserved: 0,
      stableObservations: 3
    }]
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.providerCost, 0);
});

test('delayed settlement migration persists observations and excludes settling tasks from execution concurrency', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/012_blue_runtime_delayed_usage_settlement.sql', import.meta.url),
    'utf8'
  );
  assert.match(migration, /settlement_requested_at/);
  assert.match(migration, /settlement_next_attempt_at/);
  assert.match(migration, /usage_stable_observations/);
  assert.match(migration, /state in \('provisioning', 'active'\)/);
  assert.doesNotMatch(migration, /state in \('provisioning', 'active', 'stopping'\)/);
});

test('runtime admission route rejects prompt and source payload fields', async () => {
  const route = await readFile(new URL('../app/api/runtime/v1/tasks/route.ts', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('./blueRuntime.ts', import.meta.url), 'utf8');
  assert.match(route, /FORBIDDEN_CONTENT_FIELDS/);
  assert.match(route, /'messages'/);
  assert.match(route, /'prompt'/);
  assert.match(route, /'source'/);
  assert.match(route, /publicBlueRuntimeError/);
  assert.match(runtime, /export function publicBlueRuntimeError/);
  assert.doesNotMatch(runtime, /'OpenRouter runtime management is not configured'/);
  assert.doesNotMatch(route, /chat\/completions/);
});

test('public Blue model metadata never exposes the internal transport', () => {
  const model = publicModel({
    id: 'vendor/model',
    name: 'Model',
    description: 'Served by OpenRouter at https://openrouter.ai/models/vendor/model',
    pricing: { prompt: '0', completion: '0' },
    context_length: 1000,
    supported_parameters: []
  });
  assert.doesNotMatch(model.description, /openrouter/i);
  assert.match(model.description, /Blue/);
});
