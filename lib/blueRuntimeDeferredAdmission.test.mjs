import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admission returns Blue tickets only after durable admission without asynchronous child-key setup', async () => {
  const source = await readFile(new URL('./blueRuntime.ts', import.meta.url), 'utf8');
  const admission = source.slice(source.indexOf('export async function admitBlueRuntimeTask('), source.indexOf('/** Kill switches apply'));
  const ticket = admission.indexOf('const credential = await provisionCredential(task)');
  assert.ok(ticket > admission.indexOf('getTaskForUser('));
  assert.ok(ticket > admission.indexOf(".rpc('admit_blue_runtime_task_v5'"));
  assert.doesNotMatch(admission, /getActiveCredential|createManagedKey|encrypted_key/);
  assert.match(admission, /options: \{ deferCredential\?: boolean \} = \{\}/);
  assert.doesNotMatch(admission, /void provisionCredential|setTimeout/);
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
