import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('deferred admission is opt-in and returns only after the durable task and existing credential checks', async () => {
  const source = await readFile(new URL('./blueRuntime.ts', import.meta.url), 'utf8');
  const admission = source.slice(source.indexOf('export async function admitBlueRuntimeTask('), source.indexOf('/** Kill switches apply'));
  const deferred = admission.indexOf('if (options.deferCredential)');
  assert.ok(deferred > admission.indexOf('getTaskForUser('));
  assert.ok(deferred > admission.indexOf('getActiveCredential('));
  assert.ok(deferred > admission.indexOf("active?.state === 'provisioning'"));
  assert.ok(deferred < admission.indexOf('const credential = await provisionCredential(task)'));
  assert.match(admission, /options: \{ deferCredential\?: boolean \} = \{\}/);
  assert.doesNotMatch(admission.slice(deferred), /void provisionCredential|setTimeout/);
});

test('setup routes allow provider propagation and only the explicit new header enables deferred admission', async () => {
  const route = await readFile(new URL('../app/api/runtime/v1/tasks/route.ts', import.meta.url), 'utf8');
  assert.match(route, /deferCredential: request.headers.get\('x-blue-deferred-admission'\) === '1'/);
  assert.match(route, /status: admission.state === 'active' && admission.credential \? 200 : 202/);
  for (const file of ['tasks/route.ts', 'tasks/[requestId]/route.ts', 'tasks/[requestId]/extend/route.ts']) {
    const source = await readFile(new URL('../app/api/runtime/v1/' + file, import.meta.url), 'utf8');
    assert.match(source, /export const maxDuration = 60/);
    assert.match(source, /authenticateBlueKey/);
  }
});
