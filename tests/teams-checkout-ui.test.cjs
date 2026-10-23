'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const CurrencySelector = () => null;

function evaluate(relative, imports, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const compiled = ts.transpileModule(source, { fileName: relative, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  assert.deepEqual(compiled.diagnostics, []);
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, Error, URLSearchParams, AbortController,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`); return imports[name]; }, ...globals }, { filename: relative });
  return module.exports;
}
const plans = evaluate('lib/blueTeamsPlans.ts', {});
const session = id => ({ user: { id }, access_token: `synthetic-token-${id}` });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function quote(currency = null, mode = 'upgrade') {
  const now = Date.now();
  return { version: 1, mode, from_plan: 'solo', quoted_at: new Date(now).toISOString(), effective_start: new Date(now).toISOString(),
    effective_end: new Date(now + 15 * 86_400_000).toISOString(), base_amount_inr: '500.00', base_amount_usd: '5.28', currency_locked: currency };
}
const payuPayload = { payuUrl: 'https://secure.payu.in/_payment', key: 'synthetic-key', txnid: 'synthetic-txn', amount: '500.00', productinfo: 'Blue Teams Pro', firstname: 'Fixture', email: 'fixture@example.invalid', hash: 'synthetic-hash' };

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; }
  appendChild(child) { this.children.push(child); child.parent = this; }
  replaceChildren(...children) { for (const child of this.children) child.parent = null; this.children = []; for (const child of children) this.appendChild(child); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; this.removed = true; }
  submit() { this.submitted = true; }
}

// Render the actual component and run its real effect/handler code with local
// adapters. No real SDK script, network request, form submission or charge occurs.
function checkout({ auth: initialAuth = {}, sdk = true, props: overrides = {}, sdkSession = session('buyer-a') } = {}) {
  const hooks = [], effects = [], requests = [], instances = [], scripts = [], forms = [], stored = [], navigation = [];
  const timers = new Map(), domRefs = new Set(); let nextTimer = 0, cursor = 0, tree, dirty = false, mounted = true, sessionCalls = 0;
  const auth = { user: { id: 'buyer-a' }, loading: false, ...initialAuth };
  let getSession = async () => ({ data: { session: sdkSession } });
  let fetchResponse = async url => ({ ok: true, json: async () => url.includes('paypal') ? { orderId: 'synthetic-order', txnid: 'synthetic-transaction' } : payuPayload });
  const body = new Element('body'), host = new Element('paypal-host');
  const react = {
    useState(initial) { const index = cursor++; hooks[index] ||= { value: typeof initial === 'function' ? initial() : initial }; return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; dirty = true; }]; },
    useRef(initial) { const index = cursor++; hooks[index] ||= { value: { current: initial } }; return hooks[index].value; },
    useEffect(callback, deps) { const index = cursor++; if (!hooks[index] || deps.length !== hooks[index].deps.length || deps.some((value, at) => !Object.is(value, hooks[index].deps[at]))) effects.push({ index, callback, deps }); },
  };
  const paypal = { Buttons(options) { const instance = { options, closes: 0, async render(container) { instance.container = container; container.appendChild(new Element('paypal-button')); }, async close() { instance.closes++; instance.container?.replaceChildren(); } }; instances.push(instance); return instance; } };
  const browser = {
    location: { origin: 'https://example.invalid', pathname: '/checkout/teams', search: '?session_id=synthetic-session', href: '', assign(url) { navigation.push(url); } },
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
    ...(sdk ? { paypal } : {}),
  };
  const jsx = (type, props) => ({ type, props });
  const { default: Form } = evaluate('app/checkout/teams/checkout-form.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, 'next/link': 'link',
    '@/app/components/CurrencySelector': { CurrencySelector }, '@/app/contexts/AuthContext': { useAuth: () => auth },
    '@/lib/supabase': { supabase: { auth: { getSession: () => { sessionCalls++; return getSession(); } } } }, '@/lib/blueTeamsPlans': plans,
  }, { window: browser, document: { body, createElement(tag) { const element = new Element(tag); if (tag === 'script') scripts.push(element); if (tag === 'form') forms.push(element); return element; } },
    process: { env: { NEXT_PUBLIC_PAYPAL_CLIENT_ID: 'synthetic-client-id' } }, sessionStorage: { setItem: (...args) => stored.push(args) },
    fetch: async (...args) => { requests.push(args); return fetchResponse(...args); } });
  const props = { sessionId: 'synthetic-session', returnUrl: 'https://example.invalid/console', email: 'fixture@example.invalid', tier: 'pro', sandboxTestMode: false, liveTestMode: false, imrBalance: 100, quote: null, ...overrides };
  function walk(node, visit) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(child => walk(child, visit)); visit(node); walk(node.props?.children, visit); }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (typeof node !== 'object') return String(node); if (Array.isArray(node)) return node.map(text).join(''); return text(node.props?.children); }
  function find(predicate) { let found; walk(tree, node => { if (predicate(node)) found = node; }); return found; }
  function render() {
    if (!mounted) return;
    cursor = 0; dirty = false; effects.length = 0; tree = Form(props);
    for (const ref of domRefs) ref.current = null; domRefs.clear();
    walk(tree, node => { if (node.props?.ref) { node.props.ref.current = host; domRefs.add(node.props.ref); } });
    for (const { index, callback, deps } of effects.splice(0)) { hooks[index]?.cleanup?.(); hooks[index] = { deps, cleanup: callback() }; }
  }
  async function flush() { for (let i = 0; i < 6; i++) { if (dirty) render(); await new Promise(resolve => setImmediate(resolve)); } if (dirty) render(); }
  render();
  return { requests, instances, scripts, forms, stored, navigation, browser, host, timers, auth, props, find, flush, text: () => text(tree), sessionCalls: () => sessionCalls,
    setSessionReader(value) { getSession = value; }, setFetch(value) { fetchResponse = value; },
    async setAuth(value) { Object.assign(auth, value); render(); await flush(); }, async setProps(value) { Object.assign(props, value); render(); await flush(); },
    async currency(value) { find(node => node.type === CurrencySelector).props.onChange(value); await flush(); },
    async redeem(value) { find(node => node.type === 'input' && node.props.type === 'range').props.onChange({ target: { value } }); await flush(); },
    payU() { const button = find(node => node.type === 'button' && /^Pay ₹/.test(text(node))); assert.ok(button, 'PayU button is rendered'); button.props.onClick(); },
    async loadSdk() { browser.paypal = paypal; scripts.at(-1).onload(); await flush(); },
    unmount() { mounted = false; for (const hook of hooks) hook.cleanup?.(); for (const ref of domRefs) ref.current = null; },
  };
}

test('a USD-locked upgrade initializes PayPal after asynchronous auth hydration', async () => {
  const h = checkout({ auth: { loading: true, user: null }, props: { quote: quote('USD') } });
  await h.flush(); assert.match(h.text(), /Checking your sign-in/); assert.equal(h.instances.length, 0); assert.equal(h.sessionCalls(), 0);
  await h.setAuth({ loading: false, user: { id: 'buyer-a' } });
  assert.equal(h.instances.length, 1); assert.doesNotMatch(h.text(), /Loading PayPal/);
  assert.match(h.text(), /\$5\.28/); assert.match(h.text(), /remaining.*current period/i);
  assert.equal(await h.instances[0].options.createOrder(), 'synthetic-order');
  assert.equal(h.requests[0][0], '/api/teams/checkout/paypal/create-order');
  assert.deepEqual(JSON.parse(h.requests[0][1].body), { sessionId: 'synthetic-session', returnUrl: 'https://example.invalid/console', redeemedImr: 0 });
  await h.instances[0].options.onApprove({ orderID: 'synthetic-order' });
  assert.match(h.browser.location.href, /\/api\/teams\/checkout\/paypal\/capture\?session_id=synthetic-session&token=synthetic-order&txnid=synthetic-transaction/);
});

test('quote/session changes immediately derive locked currency and discard stale IMR without a render error', async () => {
  const h = checkout(); await h.flush(); await h.redeem(20); assert.match(h.text(), /IMR Discount Applied/);
  await h.setProps({ sessionId: 'usd-upgrade', quote: quote('USD') });
  assert.match(h.text(), /Upgrade currency: USD/); assert.match(h.text(), /\$5\.28/);
  assert.doesNotMatch(h.text(), /IMR Discount Applied|Pay ₹|\$0\.00/); assert.equal(h.instances.length, 1);
  await h.setProps({ sessionId: 'inr-upgrade', quote: quote('INR') });
  assert.match(h.text(), /Pay ₹500\.00/); assert.doesNotMatch(h.text(), /IMR Discount Applied|₹0\.00/);
  assert.equal(h.find(node => node.type === CurrencySelector), undefined);
  assert.equal(h.find(node => node.type === 'input' && node.props.type === 'range'), undefined);
  assert.equal(h.instances[0].closes, 1);
  await h.setProps({ sessionId: 'fresh-normal', quote: null });
  assert.match(h.text(), /Pay ₹1499\.00/); assert.doesNotMatch(h.text(), /IMR Discount Applied/);
});

test('PayU ignores a stale session lookup before it can send a request under a changed account', async () => {
  const h = checkout(); await h.flush(); const lookup = deferred(); h.setSessionReader(() => lookup.promise);
  h.payU(); await h.flush(); await h.setAuth({ user: { id: 'buyer-b' } });
  lookup.resolve({ data: { session: session('buyer-a') } }); await h.flush();
  assert.equal(h.requests.length, 0); assert.equal(h.forms.length, 0); assert.equal(h.browser.location.href, '');
  assert.doesNotMatch(h.text(), /Opening PayU|Please sign in again/);
});

test('PayU aborts account-switched requests and never submits their late response', async () => {
  const h = checkout(); await h.flush(); const response = deferred(); h.setFetch(() => response.promise);
  h.payU(); await h.flush(); assert.equal(h.requests.length, 1);
  await h.setAuth({ user: { id: 'buyer-b' } }); assert.equal(h.requests[0][1].signal.aborted, true);
  response.resolve({ ok: true, json: async () => payuPayload }); await h.flush();
  assert.equal(h.forms.length, 0); assert.equal(h.browser.location.href, '');
  assert.doesNotMatch(h.text(), /Opening PayU/);
});

test('PayU quote/currency changes and unmount invalidate pending results without submitting forms', async () => {
  for (const mutate of [h => h.currency('USD'), h => h.setProps({ sessionId: 'different-session', quote: quote('INR') }), h => h.unmount()]) {
    const h = checkout(); await h.flush(); const response = deferred(); h.setFetch(() => response.promise);
    h.payU(); await h.flush(); await mutate(h);
    assert.equal(h.requests[0][1].signal.aborted, true);
    response.resolve({ ok: true, json: async () => payuPayload }); await h.flush(); assert.equal(h.forms.length, 0);
  }
});

test('PayU reserves synchronously and preserves server-provided amounts in the one submitted form', async () => {
  const h = checkout({ props: { quote: quote('INR') } }); await h.flush();
  h.payU(); h.payU(); await h.flush();
  assert.equal(h.requests.length, 1); assert.equal(h.forms.length, 1); assert.equal(h.forms[0].submitted, true);
  assert.deepEqual(JSON.parse(h.requests[0][1].body), { sessionId: 'synthetic-session', returnUrl: 'https://example.invalid/console', redeemedImr: 0 });
  assert.equal(h.forms[0].children.find(input => input.name === 'amount').value, '500.00');
  assert.equal(h.forms[0].action, 'https://secure.payu.in/_payment');
});

test('gateway session mismatch fails before requests and a normal PayU failure can retry', async () => {
  const h = checkout({ sdkSession: session('different-user') }); await h.flush(); h.payU(); await h.flush();
  assert.equal(h.requests.length, 0); assert.equal(h.forms.length, 0); assert.match(h.text(), /Please sign in again/);
  h.setSessionReader(async () => ({ data: { session: session('buyer-a') } }));
  h.setFetch(async () => ({ ok: false, json: async () => ({ error: 'Synthetic retryable failure' }) }));
  h.payU(); await h.flush(); assert.match(h.text(), /Synthetic retryable failure/); assert.doesNotMatch(h.text(), /Opening PayU/);
  h.setFetch(async () => ({ ok: true, json: async () => payuPayload })); h.payU(); await h.flush(); assert.equal(h.forms.length, 1);
});

test('PayPal cleanup and current identity prevent stale approval navigation after account switch or sign-out', async () => {
  for (const nextUser of [{ id: 'buyer-b' }, null]) {
    const h = checkout({ props: { quote: quote('USD') } }); await h.flush(); const old = h.instances[0];
    await old.options.createOrder(); await h.setAuth({ user: nextUser });
    assert.equal(old.closes, 1); await old.options.onApprove({ orderID: 'synthetic-order' });
    old.options.onCancel(); old.options.onError(new Error('OLD_ACCOUNT_ERROR')); await h.flush();
    assert.equal(h.browser.location.href, ''); assert.doesNotMatch(h.text(), /OLD_ACCOUNT_ERROR|checkout was cancelled/);
  }
});

test('PayPal aborts late create-order results and does not expose them to a replacement account', async () => {
  const h = checkout({ props: { quote: quote('USD') } }); await h.flush(); const response = deferred(); h.setFetch(() => response.promise);
  const old = h.instances[0], pending = old.options.createOrder(); await h.flush();
  await h.setAuth({ user: { id: 'buyer-b' } }); assert.equal(h.requests[0][1].signal.aborted, true);
  response.resolve({ ok: true, json: async () => ({ orderId: 'late-order', txnid: 'late-txn' }) });
  await assert.rejects(pending, /Checkout changed/);
  await old.options.onApprove({ orderID: 'late-order' }); assert.equal(h.browser.location.href, '');
});

test('PayPal approval rechecks SDK identity even before an account-change notification reaches React', async () => {
  const h = checkout({ props: { quote: quote('USD') } }); await h.flush(); const current = h.instances[0];
  await current.options.createOrder();
  h.setSessionReader(async () => ({ data: { session: session('buyer-b') } }));
  await current.options.onApprove({ orderID: 'synthetic-order' }); await h.flush();
  assert.equal(h.browser.location.href, ''); assert.match(h.text(), /original checkout account/);
  const lookup = deferred(); h.setSessionReader(() => lookup.promise);
  const approval = current.options.onApprove({ orderID: 'synthetic-order' }); await h.flush();
  await h.setAuth({ user: { id: 'buyer-b' } }); lookup.resolve({ data: { session: session('buyer-a') } });
  await approval; assert.equal(h.browser.location.href, '');
});

test('PayPal old session lookup cannot initiate an order and rejects the wrong current SDK user', async () => {
  const h = checkout({ props: { quote: quote('USD') } }); await h.flush(); const lookup = deferred(); h.setSessionReader(() => lookup.promise);
  const pending = h.instances[0].options.createOrder(); await h.flush(); await h.setAuth({ user: { id: 'buyer-b' } });
  lookup.resolve({ data: { session: session('buyer-a') } }); await assert.rejects(pending, /Checkout changed/); assert.equal(h.requests.length, 0);
  h.setSessionReader(async () => ({ data: { session: session('buyer-a') } }));
  await assert.rejects(h.instances.at(-1).options.createOrder(), /Please sign in again/); assert.equal(h.requests.length, 0);
});

test('a signed-out visitor returns to sign-in without a payment; SDK errors are visible, not an endless blank gate', async () => {
  const h = checkout({ auth: { user: null }, sdkSession: null }); await h.flush();
  assert.deepEqual(h.navigation, ['/console']); assert.equal(h.requests.length, 0);
  assert.deepEqual(h.stored[0], ['redirectAfterLogin', '/checkout/teams?session_id=synthetic-session']);
  const failed = checkout({ auth: { loading: true, user: null } });
  failed.setSessionReader(async () => { throw new Error('Synthetic offline'); }); await failed.setAuth({ loading: false });
  assert.match(failed.text(), /Your sign-in could not be checked/); assert.match(failed.text(), /Return to Teams/);
  assert.equal(failed.requests.length, 0); assert.equal(failed.instances.length, 0);
});

test('SDK completion after account change mounts only the current PayPal instance', async () => {
  const h = checkout({ sdk: false, props: { quote: quote('USD') } }); await h.flush(); assert.equal(h.scripts.length, 1);
  await h.setAuth({ user: { id: 'buyer-b' } }); await h.loadSdk();
  assert.equal(h.instances.length, 1); assert.equal(h.host.children.length, 1); assert.equal(h.instances[0].closes, 0);
});
