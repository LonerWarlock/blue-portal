import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decryptRuntimeSecret, encryptRuntimeSecret } from './blueRuntimeCrypto.ts';
import { publicModel } from './openrouter.ts';
import {
  assignKeyGuardrail,
  createManagedKey,
  createModelGuardrail,
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
    if (String(url).endsWith('/keys') && init.method === 'POST') {
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
    if (String(url).endsWith('/guardrails/guardrail-id/assignments/keys')) {
      return Response.json({ assigned_count: 1 });
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
    await assignKeyGuardrail(guardrailId, 'child-hash');

    assert.equal(calls.some(call => call.url.includes('/chat/completions')), false);
    assert.ok(calls.every(call => new Headers(call.init.headers).get('authorization') === 'Bearer management-only-secret'));
    const keyBody = JSON.parse(calls.find(call => call.url.endsWith('/keys')).init.body);
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
