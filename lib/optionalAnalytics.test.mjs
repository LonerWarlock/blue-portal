import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOptionalAnalytics } from './optionalAnalytics.ts';

const KEY = 'phc_optional_analytics_test';
const HOST = 'https://analytics.example.invalid';
const readSource = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function mockClient(overrides = {}) {
  const calls = { init: [], capture: [], optIn: [], optOut: [] };
  const client = {
    init(...args) { calls.init.push(args); },
    capture(...args) { calls.capture.push(args); },
    opt_in_capturing(...args) { calls.optIn.push(args); },
    opt_out_capturing(...args) { calls.optOut.push(args); },
    ...overrides,
  };
  return { client, calls };
}

function fixture(overrides = {}) {
  const mock = mockClient();
  let loads = 0;
  const analytics = createOptionalAnalytics({
    key: KEY,
    host: HOST,
    loadClient: async () => { loads += 1; return mock.client; },
    ...overrides,
  });
  return { ...mock, analytics, get loads() { return loads; } };
}

test('unselected or essential-only consent never loads the SDK or captures events', async () => {
  const f = fixture();
  assert.equal(await f.analytics.capture('before_consent'), false);
  assert.equal(await f.analytics.trackPageView('https://blue.imergene.in/teams'), false);
  f.analytics.setConsent(false);
  assert.equal(await f.analytics.capture('essential_only'), false);
  assert.equal(f.loads, 0);
  assert.deepEqual(f.calls.init, []);
  assert.deepEqual(f.calls.capture, []);
});

test('missing analytics key never loads the SDK even with consent', async () => {
  for (const key of [undefined, '']) {
    const f = fixture({ key });
    f.analytics.setConsent(true);
    assert.equal(await f.analytics.capture('consented_without_key'), false);
    assert.equal(await f.analytics.trackPageView('https://blue.imergene.in/teams'), false);
    assert.equal(f.loads, 0);
    assert.deepEqual(f.calls.init, []);
  }
});

test('consented concurrent events share one lazy load and initialize once', async () => {
  const f = fixture();
  f.analytics.setConsent(true);
  const results = await Promise.all([
    f.analytics.capture('first', { source: 'teams' }),
    f.analytics.capture('second', { source: 'guide' }),
  ]);
  assert.deepEqual(results, [true, true]);
  assert.equal(f.loads, 1);
  assert.equal(f.calls.init.length, 1);
  assert.equal(f.calls.init[0][0], KEY);
  assert.equal(f.calls.init[0][1].api_host, HOST);
  assert.equal(f.calls.init[0][1].capture_pageview, false);
  assert.equal(f.calls.init[0][1].autocapture, false);
  assert.equal(f.calls.init[0][1].opt_out_capturing_by_default, true);
  assert.equal(f.calls.init[0][1].opt_out_persistence_by_default, true);
  assert.deepEqual(f.calls.optIn[0], [{ captureEventName: false }]);
  assert.deepEqual(f.calls.capture, [
    ['first', { source: 'teams' }],
    ['second', { source: 'guide' }],
  ]);
});

test('chunk import failure is contained and a later consent grant can retry', async () => {
  const mock = mockClient();
  let loads = 0;
  const analytics = createOptionalAnalytics({
    key: KEY,
    loadClient: async () => {
      loads += 1;
      if (loads === 1) throw new Error('ChunkLoadError: optional analytics blocked');
      return mock.client;
    },
  });
  analytics.setConsent(true);
  assert.equal(await analytics.capture('not_delivered'), false);
  assert.deepEqual(mock.calls.capture, []);
  analytics.setConsent(false);
  analytics.setConsent(true);
  assert.equal(await analytics.capture('later_event'), true);
  assert.equal(loads, 2);
  assert.deepEqual(mock.calls.capture, [['later_event', undefined]]);
});

test('SDK initialization errors are contained without falsely reporting capture', async () => {
  const mock = mockClient({ init() { throw new Error('Storage unavailable'); } });
  const f = fixture({ loadClient: async () => mock.client });
  f.analytics.setConsent(true);
  assert.equal(await f.analytics.capture('init_failed'), false);
  assert.deepEqual(mock.calls.capture, []);
});

test('SDK capture errors are contained and do not prevent later events', async () => {
  const mock = mockClient();
  let fail = true;
  mock.client.capture = (...args) => {
    if (fail) throw new Error('Analytics transport unavailable');
    mock.calls.capture.push(args);
  };
  const f = fixture({ loadClient: async () => mock.client });
  f.analytics.setConsent(true);
  assert.equal(await f.analytics.capture('capture_failed'), false);
  fail = false;
  assert.equal(await f.analytics.capture('later_event', { healthy: true }), true);
  assert.deepEqual(mock.calls.capture, [['later_event', { healthy: true }]]);
});

test('revocation during a pending chunk load prevents late initialization and capture', async () => {
  const load = deferred();
  const mock = mockClient();
  const f = fixture({ loadClient: () => load.promise });
  f.analytics.setConsent(true);
  const pending = f.analytics.capture('must_not_replay');
  await Promise.resolve();
  f.analytics.setConsent(false);
  load.resolve(mock.client);
  assert.equal(await pending, false);
  assert.deepEqual(mock.calls.init, []);
  assert.deepEqual(mock.calls.capture, []);
});

test('revocation and regrant do not revive events from the previous consent grant', async () => {
  const load = deferred();
  const mock = mockClient();
  const f = fixture({ loadClient: () => load.promise });
  f.analytics.setConsent(true);
  const oldEvent = f.analytics.capture('old_consent_event');
  await Promise.resolve();
  f.analytics.setConsent(false);
  f.analytics.setConsent(true);
  const currentEvent = f.analytics.capture('current_consent_event');
  load.resolve(mock.client);
  assert.equal(await oldEvent, false);
  assert.equal(await currentEvent, true);
  assert.equal(mock.calls.init.length, 1);
  assert.deepEqual(mock.calls.capture, [['current_consent_event', undefined]]);
});

test('revocation opts an initialized SDK out and renewed consent opts it back in', async () => {
  const f = fixture();
  f.analytics.setConsent(true);
  assert.equal(await f.analytics.capture('before_revoke'), true);
  const initialOptIns = f.calls.optIn.length;
  f.analytics.setConsent(false);
  assert.equal(f.calls.optOut.length, 1);
  assert.equal(await f.analytics.capture('while_revoked'), false);
  f.analytics.setConsent(true);
  assert.equal(await f.analytics.capture('after_regrant'), true);
  assert.equal(f.loads, 1);
  assert.equal(f.calls.init.length, 1);
  assert.ok(f.calls.optIn.length > initialOptIns);
  assert.deepEqual(f.calls.capture.map(call => call[0]), ['before_revoke', 'after_regrant']);
});

test('opt-in and opt-out failures never escape into application rendering', async () => {
  const mock = mockClient({
    opt_in_capturing() { throw new Error('Opt-in failed'); },
    opt_out_capturing() { throw new Error('Opt-out failed'); },
  });
  const f = fixture({ loadClient: async () => mock.client });
  assert.doesNotThrow(() => f.analytics.setConsent(true));
  assert.equal(await f.analytics.capture('must_not_capture_without_opt_in'), false);
  assert.doesNotThrow(() => f.analytics.setConsent(false));
  assert.equal(await f.analytics.capture('still_revoked'), false);
  assert.deepEqual(mock.calls.capture, []);
});

test('newer navigation cancels stale pending pageviews and successful URLs are deduplicated', async () => {
  const load = deferred();
  const mock = mockClient();
  const f = fixture({ loadClient: () => load.promise });
  f.analytics.setConsent(true);
  const oldUrl = 'https://blue.imergene.in/teams';
  const currentUrl = 'https://blue.imergene.in/guides/ai-agent-teams';
  const oldPageview = f.analytics.trackPageView(oldUrl);
  const currentPageview = f.analytics.trackPageView(currentUrl);
  load.resolve(mock.client);
  assert.equal(await oldPageview, false);
  assert.equal(await currentPageview, true);
  assert.equal(await f.analytics.trackPageView(currentUrl), false);
  assert.deepEqual(mock.calls.capture, [['$pageview', { $current_url: currentUrl }]]);
  assert.equal(await f.analytics.trackPageView(oldUrl), true);
  assert.deepEqual(mock.calls.capture.at(-1), ['$pageview', { $current_url: oldUrl }]);
});

test('failed pageview capture can retry rather than being marked successfully tracked', async () => {
  const mock = mockClient();
  let fail = true;
  mock.client.capture = (...args) => {
    if (fail) throw new Error('Pageview failed');
    mock.calls.capture.push(args);
  };
  const f = fixture({ loadClient: async () => mock.client });
  const url = 'https://blue.imergene.in/teams';
  f.analytics.setConsent(true);
  assert.equal(await f.analytics.trackPageView(url), false);
  fail = false;
  assert.equal(await f.analytics.trackPageView(url), true);
  assert.deepEqual(mock.calls.capture, [['$pageview', { $current_url: url }]]);
});

test('concurrent duplicate pageviews invoke capture only once', async () => {
  const f = fixture();
  const url = 'https://blue.imergene.in/teams';
  f.analytics.setConsent(true);
  const results = await Promise.all([f.analytics.trackPageView(url), f.analytics.trackPageView(url)]);
  assert.deepEqual(results, [true, false]);
  assert.deepEqual(f.calls.capture, [['$pageview', { $current_url: url }]]);
});

test('course events retain their names and properties without a PostHog React dependency', async () => {
  const f = fixture();
  const properties = { step_index: 1, next_step: 2, email: 'test@example.invalid' };
  f.analytics.setConsent(true);
  assert.equal(await f.analytics.capture('vibe_coding_wizard_step_completed', properties), true);
  assert.deepEqual(f.calls.capture, [['vibe_coding_wizard_step_completed', properties]]);
  const course = readSource('app/courses/create-software-without-code/page.tsx');
  assert.match(course, /vibe_coding_wizard_step_completed/);
  assert.match(course, /vibe_coding_payment_initiated/);
  assert.doesNotMatch(course, /from\s+['"]posthog-js(?:\/react)?['"]/);
  assert.doesNotMatch(course, /\busePostHog\s*\(/);
});

test('optional SDK is dynamically loaded and is not an ancestor of public page content', () => {
  const controller = readSource('lib/optionalAnalytics.ts');
  const sidecar = readSource('app/providers/PostHogProvider.tsx');
  const layout = readSource('app/layout.tsx');
  assert.match(controller, /import\s*\(\s*['"]posthog-js['"]\s*\)/);
  // Type-only imports are safe: they are erased rather than creating a script dependency.
  assert.doesNotMatch(controller, /import\s+(?!type\b)[^;\n]+\s+from\s+['"]posthog-js(?:\/react)?['"]/);
  assert.doesNotMatch(sidecar, /from\s+['"]posthog-js(?:\/react)?['"]/);
  assert.doesNotMatch(sidecar, /(?:React\.)?lazy\s*\(/);
  assert.doesNotMatch(sidecar, /\{children\}/);
  assert.doesNotMatch(layout, /<PostHogProvider(?:\s|>)/);
  assert.match(layout, /<PostHogPageView\s*\/>/);
  assert.match(layout, /\{children\}/);
});
