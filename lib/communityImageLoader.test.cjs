const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('./communityImageLoader.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(source, { exports: exportsObject, Promise, Map, Set, Error, clearTimeout }, { timeout: 1000 });
const { CommunityImageLoader } = exportsObject;
const tick = () => new Promise(resolve => setImmediate(resolve));

test('nearby image preloads are deduplicated and bounded to two concurrent requests', async () => {
  const started = [];
  const releases = new Map();
  const manager = new CommunityImageLoader(src => { started.push(src); return new Promise(resolve => releases.set(src, resolve)); });
  const a = manager.preload('a');
  assert.equal(manager.preload('a'), a);
  const b = manager.preload('b');
  const c = manager.preload('c');
  await tick();
  assert.deepEqual(started, ['a', 'b']);
  releases.get('a')();
  await tick();
  assert.deepEqual(started, ['a', 'b', 'c']);
  releases.get('b')(); releases.get('c')();
  await Promise.all([a, b, c]);
  await manager.preload('a');
  assert.deepEqual(started, ['a', 'b', 'c']);
});

test('a rejected image releases its slot and can be retried without a poisoned cache', async () => {
  const calls = [];
  let rejected = false;
  const manager = new CommunityImageLoader(async src => {
    calls.push(src);
    if (src === 'bad' && !rejected) { rejected = true; throw new Error('Transient network failure'); }
  }, 1);
  const bad = manager.preload('bad');
  const good = manager.preload('good');
  await assert.rejects(bad, /Transient network failure/);
  const retry = manager.preload('bad');
  await Promise.all([good, retry]);
  assert.deepEqual(calls, ['bad', 'good', 'bad']);
});

test('an image completed by the page is not fetched again while waiting in the queue', async () => {
  const calls = [];
  let release;
  const manager = new CommunityImageLoader(src => { calls.push(src); return new Promise(resolve => { release = resolve; }); }, 1);
  const first = manager.preload('first');
  const waiting = manager.preload('already-visible');
  manager.remember('already-visible', 'already-visible?retry=1');
  await tick(); release();
  await Promise.all([first, waiting]);
  assert.deepEqual(calls, ['first']);
  assert.equal(manager.source('already-visible'), 'already-visible?retry=1');
  manager.forget('already-visible');
  assert.equal(manager.source('already-visible'), 'already-visible');
});

test('remembered images are bounded across future community albums', () => {
  const manager = new CommunityImageLoader(async () => {});
  for (let i = 0; i < 100; i++) manager.remember(`image-${i}`, `cached-${i}`);
  assert.equal(manager.source('image-0'), 'image-0');
  assert.equal(manager.source('image-99'), 'cached-99');
});
