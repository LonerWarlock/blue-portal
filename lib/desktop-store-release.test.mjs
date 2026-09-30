import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { DESKTOP_STORE_PRODUCT_ID, getDesktopStoreReleaseManifest, publishedDesktopStoreReleases } from './desktop-store-release.ts';

const now = Date.parse('2026-09-30T06:00:00.000Z');
const release = (version, notes = ['Improved task results.']) => ({ version, status: 'published', confirmedBy: 'partner-center',
  publishedAt: '2026-09-29T06:00:00.000Z', notes });

test('unverified current publication keeps the real catalog empty; no guessed version', () => {
  assert.deepEqual(publishedDesktopStoreReleases, []);
  assert.deepEqual(getDesktopStoreReleaseManifest(), {
    schemaVersion: 1, productId: DESKTOP_STORE_PRODUCT_ID, channel: 'microsoft-store', releases: []
  });
});

test('published metadata has a credential-free whitelist and numeric Store ordering', () => {
  const value = getDesktopStoreReleaseManifest([
    { ...release('0.1.9'), accessToken: 'must not leak', installerUrl: 'https://example.com/setup.exe' },
    release('0.1.17.1'), release('0.1.17')
  ], now);
  assert.deepEqual(value.releases.map(item => item.version), ['0.1.17.1', '0.1.17.0', '0.1.9.0']);
  assert.deepEqual(Object.keys(value.releases[0]), ['version', 'status', 'confirmedBy', 'publishedAt', 'notes']);
  assert.doesNotMatch(JSON.stringify(value), /accessToken|installerUrl|must not leak/);
});

test('uploaded/certification versions and invalid publication records cannot announce updates', () => {
  assert.deepEqual(getDesktopStoreReleaseManifest([{ version: '99.0.0', status: 'uploaded' },
    { version: '98.0.0', status: 'in-certification' }], now).releases, []);
  for (const bad of [
    { ...release('0.1.18'), confirmedBy: 'github' },
    { ...release('0.1.18'), publishedAt: '2027-01-01T00:00:00.000Z' },
    { ...release('0.1.18'), publishedAt: 'September 29, 2026' },
    release('0.1.18-beta'), release('0.1.18.65536'),
    { ...release('0.1.18'), notes: ['\u0000private'] },
    { ...release('0.1.18'), notes: ['x'.repeat(501)] }
  ]) assert.deepEqual(getDesktopStoreReleaseManifest([release('0.1.17'), bad], now).releases, []);
  assert.deepEqual(getDesktopStoreReleaseManifest([release('0.1.17'), release('0.1.17.0')], now).releases, []);
});

test('manifest stays bounded to the Desktop metadata download limit', () => {
  assert.deepEqual(getDesktopStoreReleaseManifest(Array.from({ length: 33 }, (_, index) => release(`0.1.${index}`)), now).releases, []);
  const oversized = Array.from({ length: 32 }, (_, index) => release(`0.1.${index}`, Array.from({ length: 10 }, () => 'x'.repeat(500))));
  assert.deepEqual(getDesktopStoreReleaseManifest(oversized, now).releases, []);
});

test('public GET requires no account/model/database module and returns safe cacheable JSON', async () => {
  const source = await readFile(new URL('../app/api/desktop/store-release/route.ts', import.meta.url), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
  } }).outputText, { exports: module.exports, Response,
    require(id) { assert.equal(id, '@/lib/desktop-store-release'); return { getDesktopStoreReleaseManifest }; } });
  const response = module.exports.GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300, s-maxage=300, stale-while-revalidate=300');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await response.json(), getDesktopStoreReleaseManifest());
  assert.equal(module.exports.runtime, 'nodejs');
});
