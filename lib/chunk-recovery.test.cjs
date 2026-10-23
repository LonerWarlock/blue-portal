'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { FAILED_INITIAL_CHUNK_CLEANUP, installChunkRecovery, ChunkLoadRecoveryPlugin } = require('./chunk-recovery.cjs');

function harness(events) {
  const calls = [], callbacks = [], timers = [];
  const runtime = { l(url, done, key, chunkId) {
    calls.push({ url, key, chunkId });
    const type = events.shift() || 'error';
    done({ type, target: { src: url } });
  }, u() { return 'untouched RSC mapping'; } };
  const originalMapping = runtime.u;
  vm.runInNewContext(`(${installChunkRecovery.toString()})(runtime)`, {
    runtime, URL, document: { baseURI: 'https://blue.imergene.in/guides/example' },
    location: { origin: 'https://blue.imergene.in' },
    setTimeout(callback, delay) { timers.push({ callback, delay }); },
  });
  function start(url = '/_next/static/chunks/app/layout-123abc.js?dpl=verified') {
    runtime.l(url, event => callbacks.push(event), 'chunk-3185', 3185);
  }
  function flush() {
    let count = 0;
    while (timers.length) { assert.ok(++count <= 2, 'Retries must remain bounded'); timers.shift().callback(); }
  }
  return { runtime, originalMapping, calls, callbacks, timers, start, flush };
}

test('normal loads are unchanged, including the RSC filename map and loader arguments', () => {
  const h = harness(['load']); h.start();
  assert.equal(h.calls.length, 1); assert.equal(h.timers.length, 0);
  assert.equal(h.callbacks[0].type, 'load');
  assert.equal(h.runtime.u, h.originalMapping);
  assert.equal(h.calls[0].key, 'chunk-3185'); assert.equal(h.calls[0].chunkId, 3185);
});

for (const failures of [1, 2]) test(`recovers after ${failures} transport failures before notifying the caller`, () => {
  const h = harness([...Array(failures).fill('error'), 'load']); h.start();
  assert.equal(h.callbacks.length, 0); assert.equal(h.timers[0].delay, 150);
  h.flush();
  assert.equal(h.calls.length, failures + 1); assert.equal(h.callbacks.length, 1);
  assert.equal(h.callbacks[0].type, 'load');
  for (let i = 1; i < h.calls.length; i++) {
    const url = new URL(h.calls[i].url);
    assert.equal(url.origin, 'https://blue.imergene.in');
    assert.equal(url.pathname, '/_next/static/chunks/app/layout-123abc.js');
    assert.equal(url.searchParams.get('dpl'), 'verified');
    assert.equal(url.searchParams.get('blue_chunk_retry'), String(i));
    assert.equal(h.calls[i].key, 'chunk-3185');
  }
});

test('persistent failure propagates once after two retries, with no reload or infinite loop', () => {
  const h = harness(['error', 'error', 'error']); h.start(); h.flush();
  assert.equal(h.calls.length, 3); assert.equal(h.callbacks.length, 1);
  assert.equal(h.callbacks[0].type, 'error'); assert.equal(h.timers.length, 0);
});

test('timeouts can recover, while successful transport is not treated as application success', () => {
  const h = harness(['timeout', 'load']); h.start(); h.flush();
  assert.equal(h.calls.length, 2); assert.equal(h.callbacks[0].type, 'load');
  // Missing chunk registration is diagnosed by Webpack's original done
  // callback; we do not swallow it or retry arbitrary JavaScript exceptions.
  const missing = harness(['load']); missing.start(); missing.flush();
  assert.equal(missing.calls.length, 1);
});

test('foreign scripts, CSS, APIs and non-Next paths never gain retries', () => {
  for (const url of ['https://other.example/_next/static/chunks/a.js', '/_next/static/css/a.css',
    '/api/auth', '/app.js', 'not a valid URL://']) {
    const h = harness(['error']); h.start(url); h.flush();
    assert.equal(h.calls.length, 1); assert.equal(h.callbacks[0].type, 'error');
  }
});

test('early cleanup removes only failed same-origin Next scripts and leaves error propagation intact', () => {
  let listener, removed = 0;
  vm.runInNewContext(FAILED_INITIAL_CHUNK_CLEANUP, {
    URL, location: { origin: 'https://blue.imergene.in' }, document: {
      baseURI: 'https://blue.imergene.in/',
      addEventListener(name, callback, capture) {
        assert.equal(name, 'error'); assert.equal(capture, true); listener = callback;
      },
    },
  });
  const parentNode = { removeChild() { removed++; } };
  listener({ target: { tagName: 'SCRIPT', src: '/_next/static/chunks/app/layout-a.js', parentNode } });
  assert.equal(removed, 1);
  for (const target of [null, { tagName: 'IMG', src: '/image.png', parentNode },
    { tagName: 'SCRIPT', src: 'https://other.example/_next/static/chunks/a.js', parentNode },
    { tagName: 'SCRIPT', src: '/other.js', parentNode }]) listener({ target });
  assert.equal(removed, 1);
});

test('recovery plugin is enabled only for production browser builds', () => {
  const { PHASE_PRODUCTION_BUILD } = require('next/constants');
  const config = require('../next.config.js')(PHASE_PRODUCTION_BUILD);
  for (const [dev, isServer, count] of [[false, false, 1], [true, false, 0], [false, true, 0]]) {
    const result = config.webpack({ plugins: [] }, { dev, isServer });
    assert.equal(result.plugins.length, count);
    if (count) assert.ok(result.plugins[0] instanceof ChunkLoadRecoveryPlugin);
  }
});
