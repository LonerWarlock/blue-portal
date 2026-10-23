'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function evaluate(relative, imports, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    fileName: relative, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.deepEqual(compiled.diagnostics, []);
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports, Date, Error, URLSearchParams,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`); return imports[name]; },
    ...globals,
  }, { filename: relative });
  return module.exports;
}

const plans = evaluate('lib/blueTeamsPlans.ts', {});
const entitlement = evaluate('lib/blueTeamsEntitlement.ts', { './blueTeamsPlans': plans });
const future = () => new Date(Date.now() + 30 * 86_400_000).toISOString();
const noTeams = { plan: null, status: 'inactive', current_period_end: null, active_project_teams: 0, agents_per_team: 0 };
function account(id, tier = 'pro', expires = future()) {
  return {
    user_id: id, subscription: { plan: 'blue_pro', is_pro: true }, wallet: { balance: 100 },
    teams: tier ? { plan: tier, status: 'active', current_period_end: expires, active_project_teams: plans.BLUE_TEAMS_PLANS[tier]?.projectTeams, agents_per_team: plans.BLUE_TEAMS_PLANS[tier]?.agentsPerTeam } : noTeams,
  };
}

// Execute the actual component with deterministic React adapters. The account
// source is the existing AuthContext contract; no browser or remote DB/payment
// service is called, and this fixture cannot grant an entitlement.
function harness(initial = {}) {
  const hooks = [], effects = [], requests = [], navigation = [];
  const auth = { user: null, session: null, loading: false, account: null, accountLoading: false, accountError: '', invalidateAccount: async () => { auth.refreshes++; return auth.account; }, refreshes: 0, ...initial };
  let cursor = 0, tree, dirty = false;
  let now = Date.now();
  class ClockDate extends Date { static now() { return now; } }
  let fetchResponse = async () => ({ ok: true, json: async () => ({ session_id: 'synthetic-checkout' }) });
  const timers = new Map(); let timerId = 0;
  const react = {
    useState(value) { const slot = cursor++; if (!hooks[slot]) hooks[slot] = { value: typeof value === 'function' ? value() : value }; return [hooks[slot].value, next => { hooks[slot].value = typeof next === 'function' ? next(hooks[slot].value) : next; dirty = true; }]; },
    useRef(value) { const slot = cursor++; hooks[slot] ||= { value: { current: value } }; return hooks[slot].value; },
    useEffect(callback, deps) { const slot = cursor++; if (!hooks[slot] || deps.some((value, index) => !Object.is(value, hooks[slot].deps[index]))) effects.push({ slot, callback, deps }); },
  };
  const jsx = (type, props) => ({ type, props });
  const browser = { location: { origin: 'https://example.invalid', search: '', href: '' }, setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } };
  const { default: TeamsClient } = evaluate('app/teams/TeamsClient.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { useRouter: () => ({ push: value => navigation.push(value) }) },
    'next/link': 'link', 'lucide-react': Object.fromEntries(['ArrowRight', 'ArrowUpRight', 'Check', 'Loader2', 'ShieldCheck', 'Sparkles'].map(name => [name, name])),
    '@/app/contexts/AuthContext': { useAuth: () => auth },
    '@/app/components/PageLayout': 'layout', '@/app/components/TeamWorkspacePreview': 'preview',
    '@/lib/blueTeamsPlans': plans, '@/lib/blueTeamsEntitlement': entitlement,
    './teams.module.css': new Proxy({}, { get: (_, key) => key }),
  }, { Date: ClockDate, window: browser, sessionStorage: { setItem() {} }, fetch: async (...args) => { requests.push(args); return fetchResponse(...args); } });
  const checkout = { checkoutEnabled: true, testMode: false, liveTestPriceEnabled: false, paypalAvailable: true };
  function render() {
    cursor = 0; dirty = false; effects.length = 0; tree = TeamsClient({ checkout });
    for (const { slot, callback, deps } of effects.splice(0)) { hooks[slot]?.cleanup?.(); hooks[slot] = { deps, cleanup: callback() }; }
  }
  function walk(node, callback) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(child => walk(child, callback)); callback(node); walk(node.props?.children, callback); }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (typeof node !== 'object') return String(node); if (Array.isArray(node)) return node.map(text).join(''); return text(node.props?.children); }
  function find(predicate) { let found; walk(tree, node => { if (predicate(node)) found = node; }); return found; }
  function button(label) { return find(node => node.type === 'button' && text(node).trim() === label); }
  function setAuth(patch) { Object.assign(auth, patch); render(); if (dirty) render(); }
  render(); if (dirty) render();
  return { auth, requests, navigation, browser, text: () => text(tree), find, button, setAuth, render, setFetch: value => { fetchResponse = value; }, advance(ms) { now += ms; for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } render(); }, async flush() { await new Promise(resolve => setImmediate(resolve)); if (dirty) render(); } };
}

test('Teams shows only the authenticated current plan, exact expiry, capacity and same-plan renewal', () => {
  const expires = future(), h = harness({ user: { id: 'buyer' }, session: { access_token: 'fixture-token' }, account: account('buyer', 'pro', expires) });
  assert.match(h.text(), /Teams Pro is active/);
  assert.match(h.text(), /3 active project teams · Up to 5 agents per team/);
  assert.match(h.text(), /no auto-renewal/);
  assert.equal(h.find(node => node.type === 'time').props.dateTime, expires);
  assert.ok(h.button('Renew Pro'));
  assert.ok(h.button('Change to Solo at expiry')); assert.ok(h.button('Upgrade to Business'));
  assert.equal((h.text().match(/Current plan/g) || []).length, 1);
  assert.equal(h.requests.length, 0, 'active plan reuses AuthContext instead of duplicating the account fetch');
});

test('expired, missing, malformed and regular Blue-only plans never appear as active Teams', () => {
  const h = harness({ user: { id: 'buyer' }, account: account('buyer', 'pro', new Date(Date.now() - 1000).toISOString()) });
  assert.doesNotMatch(h.text(), /Teams Pro is active|Current plan|Renew Pro/);
  assert.match(h.text(), /No active Blue Teams plan/);
  h.setAuth({ account: account('buyer', null) });
  assert.match(h.text(), /Your regular Blue plan and credits are separate/);
  assert.ok(h.button('Choose Pro'));
  for (const teams of [undefined, { plan: 'admin', status: 'active', current_period_end: future() }, { plan: 'pro', status: 'active', current_period_end: 'not-a-date' }]) {
    h.setAuth({ account: { ...account('buyer'), teams } });
    assert.doesNotMatch(h.text(), /Teams Pro is active|Current plan|Renew Pro/);
  }
});

test('loading, failed refresh, sign-out and account switches hide any former current-plan badge', async () => {
  const h = harness({ user: { id: 'buyer-a' }, account: account('buyer-a') });
  h.setAuth({ accountLoading: true });
  assert.match(h.text(), /Checking your Teams plan/); assert.doesNotMatch(h.text(), /Teams Pro is active|Current plan|Renew Pro/);
  h.setAuth({ accountLoading: false, accountError: 'Network unavailable' });
  assert.match(h.text(), /could not be verified/); assert.doesNotMatch(h.text(), /Teams Pro is active|Current plan/);
  await h.button('Retry account refresh').props.onClick(); assert.equal(h.auth.refreshes, 1);
  h.setAuth({ accountError: '', user: { id: 'buyer-b' } });
  assert.doesNotMatch(h.text(), /Teams Pro is active|Current plan|Renew Pro/);
  h.setAuth({ account: account('buyer-b', 'solo') }); assert.match(h.text(), /Teams Solo is active/); assert.ok(h.button('Renew Solo'));
  h.setAuth({ user: null, session: null });
  assert.doesNotMatch(h.text(), /Teams Solo is active|Current plan|Renew Solo/);
  assert.ok(h.button('Sign in to choose'));
  assert.equal(h.requests.length, 0);
});

test('refresh controls use the shared account invalidator and refreshed account updates the plan', async () => {
  const h = harness({ user: { id: 'buyer' }, account: account('buyer', null) });
  h.setAuth({ account: account('buyer', 'business') });
  assert.ok(h.button('Renew Business')); await h.button('Refresh plan').props.onClick();
  assert.equal(h.auth.refreshes, 1); assert.equal(h.requests.length, 0);
  h.setAuth({ account: account('buyer', null) }); assert.doesNotMatch(h.text(), /Teams Business is active|Current plan/);
});

test('Renew keeps the existing checkout API and sends only the selected tier', async () => {
  const h = harness({ user: { id: 'buyer' }, session: { access_token: 'fixture-token' }, account: account('buyer') });
  await h.button('Renew Pro').props.onClick(); await h.flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0][0], '/api/teams/checkout/create-session');
  assert.deepEqual(JSON.parse(h.requests[0][1].body), { tier: 'pro' });
  assert.equal(h.requests[0][1].headers.Authorization, 'Bearer fixture-token');
  assert.match(h.browser.location.href, /^\/checkout\/teams\?session_id=synthetic-checkout&return_url=/);
});

test('the active badge expires while the Teams page remains open', () => {
  const h = harness({ user: { id: 'buyer' }, account: account('buyer') });
  assert.ok(h.button('Renew Pro'));
  h.advance(31 * 86_400_000);
  assert.doesNotMatch(h.text(), /Teams Pro is active|Current plan|Renew Pro/);
  assert.match(h.text(), /No active Blue Teams plan/);
});

test('an old account checkout result cannot redirect a newly signed-in user', async () => {
  const h = harness({ user: { id: 'buyer-a' }, session: { access_token: 'fixture-a' }, account: account('buyer-a') });
  let resolve;
  h.setFetch(() => new Promise(done => { resolve = done; }));
  const pending = h.button('Renew Pro').props.onClick();
  h.setAuth({ user: { id: 'buyer-b' }, session: { access_token: 'fixture-b' }, account: account('buyer-b', 'solo') });
  resolve({ ok: true, json: async () => ({ session_id: 'old-account-checkout' }) });
  await pending; await h.flush();
  assert.equal(h.browser.location.href, '');
  assert.match(h.text(), /Teams Solo is active/);
  assert.doesNotMatch(h.text(), /Teams Pro is active/);
});

test('lower tiers schedule a no-charge expiry change through the authenticated endpoint', async () => {
  const h = harness({ user: { id: 'buyer' }, session: { access_token: 'fixture-token' }, account: account('buyer', 'business') });
  await h.button('Change to Pro at expiry').props.onClick(); await h.flush();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0][0], '/api/teams/plan-change');
  assert.deepEqual(JSON.parse(h.requests[0][1].body), { tier: 'pro' });
  assert.equal(h.requests[0][1].headers.Authorization, 'Bearer fixture-token');
  assert.equal(h.browser.location.href, '', 'a scheduled downgrade does not initiate checkout');
  assert.equal(h.auth.refreshes, 1);
  assert.match(h.text(), /Payment will be required to start the new plan; you will not be charged automatically/);
});

test('scheduled changes show their verified effective date and may be cancelled without checkout', async () => {
  const record = account('buyer', 'business');
  record.teams.scheduled_change = { plan: 'solo', change_at: record.teams.current_period_end, payment_required: true };
  const h = harness({ user: { id: 'buyer' }, session: { access_token: 'fixture-token' }, account: record });
  assert.match(h.text(), /Teams Business is active/); assert.match(h.text(), /Teams Solo is scheduled/);
  assert.match(h.text(), /Payment is required to start this prepaid plan; there is no automatic charge/);
  await h.button('Cancel scheduled change').props.onClick(); await h.flush();
  assert.equal(h.requests[0][0], '/api/teams/plan-change');
  assert.deepEqual(JSON.parse(h.requests[0][1].body), { tier: null });
  assert.equal(h.auth.refreshes, 1); assert.equal(h.browser.location.href, '');
  assert.match(h.text(), /Your scheduled plan change was cancelled/);
});

test('a Teams-specific server lookup outage never becomes an inactive plan or a purchasable new subscription', async () => {
  const record = account('buyer'); record.teams.available = false;
  const h = harness({ user: { id: 'buyer' }, session: { access_token: 'fixture-token' }, account: record });
  assert.match(h.text(), /Your Teams plan could not be verified/);
  assert.doesNotMatch(h.text(), /Teams Pro is active|Current plan|No active Blue Teams plan/);
  assert.equal(h.button('Plan unavailable').props.disabled, true);
  await h.button('Plan unavailable').props.onClick();
  assert.equal(h.requests.length, 0);
  await h.button('Retry account refresh').props.onClick(); assert.equal(h.auth.refreshes, 1);
  record.teams.available = true; h.setAuth({ account: record }); assert.ok(h.button('Renew Pro'));
});

test('the chosen lower plan remains visible after expiry without granting access, and starts a normal checkout only on click', async () => {
  const record = account('buyer', 'business');
  record.teams.scheduled_change = { plan: 'solo', change_at: record.teams.current_period_end, payment_required: true };
  const h = harness({ user: { id: 'buyer' }, session: { access_token: 'fixture-token' }, account: record });
  h.advance(31 * 86_400_000);
  assert.match(h.text(), /Chosen next plan: Teams Solo — payment required/);
  assert.match(h.text(), /does not become active until you complete payment/);
  assert.doesNotMatch(h.text(), /Teams (?:Business|Solo) is active|Current plan|Renew Solo/);
  assert.match(h.text(), /No active Blue Teams plan/);
  assert.equal(h.requests.length, 0, 'a stored preference never charges automatically');
  // The server now returns an inactive entitlement, preserving only the safe
  // scheduled choice; this is the state after a fresh post-expiry account load.
  h.setAuth({ account: { ...record, teams: { ...noTeams, scheduled_change: record.teams.scheduled_change } } });
  assert.match(h.text(), /Chosen next plan: Teams Solo — payment required/);
  await h.button('Complete Solo checkout').props.onClick(); await h.flush();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0][0], '/api/teams/checkout/create-session');
  assert.deepEqual(JSON.parse(h.requests[0][1].body), { tier: 'solo' });
});

test('a chosen plan may be cancelled after expiry and hides at sign-out or an account switch', async () => {
  const saved = { plan: 'pro', change_at: new Date(Date.now() - 1000).toISOString(), payment_required: true };
  const record = { ...account('buyer', null), teams: { ...noTeams, scheduled_change: saved } };
  const h = harness({ user: { id: 'buyer' }, session: { access_token: 'fixture-token' }, account: record });
  assert.ok(h.button('Cancel scheduled change'));
  await h.button('Cancel scheduled change').props.onClick(); await h.flush();
  assert.equal(h.requests[0][0], '/api/teams/plan-change'); assert.deepEqual(JSON.parse(h.requests[0][1].body), { tier: null });
  h.setAuth({ user: { id: 'another-user' } }); assert.doesNotMatch(h.text(), /Chosen next plan|is scheduled/);
  h.setAuth({ user: null, session: null }); assert.doesNotMatch(h.text(), /Chosen next plan|is scheduled/);
});
