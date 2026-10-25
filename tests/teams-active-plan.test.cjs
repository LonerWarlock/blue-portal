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
    'next/link': { default: 'link' }, 'lucide-react': Object.fromEntries(['ArrowRight', 'ArrowUpRight', 'Check', 'Loader2', 'ShieldCheck', 'Sparkles'].map(name => [name, name])),
    '@/app/contexts/AuthContext': { useAuth: () => auth },
    '@/app/components/PageLayout': { default: 'layout' }, '@/app/components/TeamWorkspacePreview': { default: 'preview' },
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

function paidAccount(id, balance = 15, active = true) {
  return { user_id: id, teams: { plan: active ? 'payg' : null, status: active ? 'active' : 'inactive', access_source: active ? 'credits' : null,
    blue_models_only: true, available: true, current_period_end: null, available_blue_credits: balance, total_blue_credits: balance,
    required_purchase_credits: 25, active_project_teams: active ? 10 : 0, agents_per_team: active ? 8 : 0 } };
}
test('Teams displays only the authenticated server credit entitlement and uses credit top-up links', () => {
  const h = harness({ user: { id: 'buyer' }, account: paidAccount('buyer') });
  assert.match(h.text(), /Blue Teams is active/); assert.match(h.text(), /15 Blue Credits available/);
  assert.match(h.text(), /Top up before your balance runs out/);
  assert.equal(h.find(node => node.type === 'link' && /Add Blue Credits/.test(String(node.props.children))).props.href, '/blue-pro/checkout');
  assert.doesNotMatch(h.text(), /Choose Solo|Choose Pro|Choose Business|Renew Pro|Upgrade to Business|monthly prepaid/i);
  assert.equal(h.requests.length,0);
});
test('a positive wallet alone never activates Teams and the activation CTA selects a single25credit purchase', () => {
  const h=harness({ user:{id:'buyer'},account:paidAccount('buyer',100,false)});
  assert.doesNotMatch(h.text(),/Blue Teams is active/); assert.match(h.text(), /qualifying credit purchase/);
  assert.match(h.text(), /100 Blue Credits available/);
  assert.equal(h.find(node=>node.type==='link' && node.props.href.includes('credits=25')).props.href,'/blue-pro/checkout?pack=custom&credits=25');
  assert.equal(h.requests.length,0);
});
test('loading, account errors and account switches hide the previous access decision', async () => {
  const h=harness({user:{id:'buyer-a'},account:paidAccount('buyer-a')});
  h.setAuth({accountLoading:true});assert.doesNotMatch(h.text(),/Blue Teams is active/);assert.match(h.text(),/Checking your Teams access/);
  h.setAuth({accountLoading:false,accountError:'Failed'});assert.doesNotMatch(h.text(),/Blue Teams is active/);
  await h.button('Retry account refresh').props.onClick();assert.equal(h.auth.refreshes,1);
  h.setAuth({accountError:'',user:{id:'buyer-b'}});assert.doesNotMatch(h.text(),/Blue Teams is active|15 Blue Credits available/);
  h.setAuth({account:paidAccount('buyer-b',40)});assert.match(h.text(),/40 Blue Credits available/);
  h.setAuth({user:null,account:null});assert.doesNotMatch(h.text(),/Blue Teams is active|40 Blue Credits available/);
});
test('legacy paid access is labelled by its verified expiry and never creates another subscription', () => {
  const record=paidAccount('buyer');Object.assign(record.teams,{plan:'pro',access_source:'legacy_subscription',current_period_end:future()});
  const h=harness({user:{id:'buyer'},account:record});assert.match(h.text(),/previously purchased Teams access is honoured until/);
  assert.ok(h.find(node=>node.type==='time'));assert.doesNotMatch(h.text(),/Renew Pro|Change to Solo|Upgrade to Business/);
  record.teams.current_period_end=new Date(Date.now()-1000).toISOString();h.setAuth({account:record});assert.doesNotMatch(h.text(),/Blue Teams is active|honoured until/);
});
test('failed verification cannot display active access even if stale fields say active', () => {
  const record=paidAccount('buyer');record.teams.available=false;
  const h=harness({user:{id:'buyer'},account:record});assert.doesNotMatch(h.text(),/Blue Teams is active/);assert.match(h.text(),/could not be verified/);
});
test('Teams keeps its workspace preview and clearly explains model billing, fees, top-ups and zero-balance pause', () => {
  const h=harness();assert.ok(h.find(node=>node.type==='preview' && node.props.variant==='pricing'));
  assert.match(h.text(),/25 Blue Credits in one payment/);assert.match(h.text(),/30% platform fee/);assert.match(h.text(),/32.50 USD/);
  assert.match(h.text(),/Main agent and specialists use Blue Models/);assert.match(h.text(),/Your agents, tasks and conversations remain saved/);
  assert.match(h.text(),/balance becomes 40 Blue Credits/);assert.equal(h.requests.length,0);
});
