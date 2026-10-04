const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const portalRoot = path.resolve(__dirname, '..');
const CurrencySelector = () => null;

function evaluateTypeScript(relativePath, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(portalRoot, relativePath), 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
    fileName: relativePath,
  });
  assert.equal(diagnostics.length, 0);
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module, exports: module.exports,
    require: name => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
    Error, URLSearchParams, AbortController, ...globals,
  }, { filename: relativePath });
  return module.exports;
}

const plans = evaluateTypeScript('lib/blueSubscriptionPlans.ts');

class FakeElement {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; }
  appendChild(child) { this.children.push(child); child.parent = this; }
  replaceChildren(...children) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    for (const child of children) this.appendChild(child);
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
    this.removed = true;
  }
}

function makeCheckout({ cycle = 'monthly', clientId = 'test-client', sdk, session = { access_token: 'test-access-token' }, renderFailure = false } = {}) {
  const hooks = [];
  const scripts = [];
  const buttonInstances = [];
  const requests = [];
  const timers = new Map();
  const body = new FakeElement('body');
  const host = new FakeElement('paypal-host');
  let hookIndex = 0;
  let pendingEffects = [];
  let dirty = false;
  let tree;
  let nextTimer = 0;
  let nextOrder = 0;
  let responseError;

  const react = {
    useState(initial) {
      const index = hookIndex++;
      hooks[index] ||= { value: initial };
      return [hooks[index].value, value => {
        hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value;
        dirty = true;
      }];
    },
    useRef(initial) {
      const index = hookIndex++;
      hooks[index] ||= { value: { current: initial } };
      return hooks[index].value;
    },
    useEffect(callback, deps) {
      const index = hookIndex++;
      if (!hooks[index] || deps.some((value, i) => value !== hooks[index].deps[i])) {
        pendingEffects.push({ index, callback, deps });
      }
    },
  };
  const window = {
    location: { href: '' },
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const paypalSdk = {
    Buttons(options) {
      const instance = {
        options, closes: 0,
        render(container) {
          instance.container = container;
          container.appendChild(new FakeElement('paypal-button'));
          if (renderFailure) { renderFailure = false; return Promise.reject(new Error('PayPal buttons failed to render')); }
          return Promise.resolve();
        },
        close() { instance.closes += 1; instance.container?.replaceChildren(); return Promise.resolve(); },
      };
      buttonInstances.push(instance);
      return instance;
    },
  };
  if (sdk) window.paypal = paypalSdk;
  const jsx = (type, props) => ({ type, props });
  const { CheckoutForm } = evaluateTypeScript('app/checkout/blue/checkout-form.tsx', {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    '@/app/components/CurrencySelector': { CurrencySelector },
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session } }) } } },
    '@/lib/blueSubscriptionPlans': plans,
    'next/link': () => null,
  }, {
    process: { env: { NEXT_PUBLIC_PAYPAL_CLIENT_ID: clientId } },
    window,
    document: {
      body,
      createElement(tag) { const element = new FakeElement(tag); if (tag === 'script') scripts.push(element); return element; },
    },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      const order = ++nextOrder;
      return { ok: !responseError, json: async () => responseError ? { error: responseError } : { orderId: `order-${order}`, txnid: `transaction-${order}` } };
    },
  });
  const props = { sessionId: `${cycle}-session`, returnUrl: 'https://example.com/console', email: 'buyer@example.com', imrBalance: 100, billingCycle: cycle };

  function walk(node, visit) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(child => walk(child, visit)); return; }
    visit(node);
    walk(node.props?.children, visit);
  }
  function render() {
    dirty = false;
    hookIndex = 0;
    pendingEffects = [];
    tree = CheckoutForm(props);
    for (const hook of hooks) if (hook?.value && Object.hasOwn(hook.value, 'current')) hook.value.current = null;
    walk(tree, node => { if (node.props?.ref) node.props.ref.current = host; });
    for (const { index, callback, deps } of pendingEffects) {
      hooks[index]?.cleanup?.();
      hooks[index] = { deps, cleanup: callback() };
    }
  }
  function find(predicate) { let found; walk(tree, node => { if (predicate(node)) found = node; }); return found; }
  function textContent(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    if (Array.isArray(node)) return node.map(textContent).join('');
    return textContent(node.props?.children);
  }
  async function flush() {
    for (let i = 0; i < 4; i++) {
      if (dirty) render();
      await new Promise(resolve => setImmediate(resolve));
    }
    if (dirty) render();
  }
  render();
  return {
    scripts, buttonInstances, requests, window, host, timers, flush, text: () => textContent(tree),
    async currency(value) { find(node => node.type === CurrencySelector).props.onChange(value); await flush(); },
    async redeem(value) { find(node => node.type === 'input' && node.props.type === 'range').props.onChange({ target: { value } }); await flush(); },
    async loaded() { window.paypal = paypalSdk; scripts.at(-1).onload(); await flush(); },
    async retry() { find(node => node.type === 'button' && textContent(node) === 'Try loading PayPal again').props.onClick(); await flush(); },
    failRequests(message) { responseError = message; },
  };
}

for (const [cycle, usd, days] of [['monthly', '1.99', 30], ['quarterly', '5.33', 90], ['yearly', '17.35', 365]]) {
  test(`${cycle} USD checkout uses the selected plan and authenticated order/capture flow`, async () => {
    const checkout = makeCheckout({ cycle });
    await checkout.redeem(20);
    assert.match(checkout.text(), /IMR Discount Applied/);
    await checkout.currency('USD');
    assert.match(checkout.text(), new RegExp(`\\$${usd.replace('.', '\\.')} /`));
    assert.match(checkout.text(), new RegExp(`${days} days`));
    assert.doesNotMatch(checkout.text(), /IMR Discount Applied/);
    assert.equal(checkout.scripts.length, 1);
    const sdkUrl = new URL(checkout.scripts[0].src);
    assert.equal(sdkUrl.searchParams.get('currency'), 'USD');
    assert.equal(sdkUrl.searchParams.get('intent'), 'capture');
    await checkout.loaded();
    const buttons = checkout.buttonInstances[0];
    assert.equal(await buttons.options.createOrder(), 'order-1');
    const request = checkout.requests[0];
    assert.equal(request.url, '/api/checkout/paypal/create-order');
    assert.equal(request.headers.Authorization, 'Bearer test-access-token');
    assert.deepEqual(JSON.parse(request.body), { sessionId: `${cycle}-session`, returnUrl: 'https://example.com/console', redeemedImr: 0 });
    await buttons.options.onApprove({ orderID: 'order-1' });
    const capture = new URL(checkout.window.location.href, 'https://example.com');
    assert.equal(capture.pathname, '/api/checkout/paypal/capture');
    assert.equal(capture.searchParams.get('token'), 'order-1');
    assert.equal(capture.searchParams.get('txnid'), 'transaction-1');
    assert.equal(capture.searchParams.get('session_id'), `${cycle}-session`);
    assert.match(checkout.text(), /No automatic renewal/);
  });
}

test('currency switches during SDK loading and after rendering keep one active button instance', async () => {
  const checkout = makeCheckout();
  await checkout.currency('USD');
  await checkout.currency('INR');
  await checkout.currency('USD');
  assert.equal(checkout.scripts.length, 1);
  await checkout.loaded();
  assert.equal(checkout.buttonInstances.length, 1);
  const stale = checkout.buttonInstances[0];
  await stale.options.createOrder();
  await checkout.currency('INR');
  assert.equal(stale.closes, 1);
  await stale.options.onApprove({ orderID: 'order-1' });
  assert.equal(checkout.window.location.href, '');
  await checkout.currency('USD');
  assert.equal(checkout.scripts.length, 1);
  assert.equal(checkout.buttonInstances.length, 2);
  assert.equal(checkout.host.children.length, 1);
  const active = checkout.buttonInstances[1];
  await active.options.createOrder();
  await active.options.onApprove({ orderID: 'order-2' });
  assert.match(checkout.window.location.href, /txnid=transaction-2/);
});

test('cancelled checkout can retry and rejects an approval for a different order', async () => {
  const checkout = makeCheckout({ sdk: true });
  await checkout.currency('USD');
  const options = checkout.buttonInstances[0].options;
  await options.createOrder();
  options.onCancel();
  await checkout.flush();
  assert.match(checkout.text(), /checkout was cancelled/);
  assert.doesNotMatch(checkout.text(), /Completing your PayPal checkout/);
  await options.createOrder();
  await options.onApprove({ orderID: 'order-1' });
  await checkout.flush();
  assert.equal(checkout.window.location.href, '');
  assert.match(checkout.text(), /Unable to confirm/);
  await options.onApprove({ orderID: 'order-2' });
  assert.match(checkout.window.location.href, /txnid=transaction-2/);
});

test('unauthenticated and failed orders surface errors and recover from busy state', async () => {
  for (const session of [null, { access_token: 'test-access-token' }]) {
    const checkout = makeCheckout({ sdk: true, session });
    await checkout.currency('USD');
    checkout.failRequests('Payment session expired');
    const options = checkout.buttonInstances[0].options;
    await assert.rejects(options.createOrder(), err => {
      options.onError(err);
      return /sign in again|Payment session expired/.test(err.message);
    });
    await checkout.flush();
    assert.match(checkout.text(), /sign in again|Payment session expired/);
    assert.doesNotMatch(checkout.text(), /Completing your PayPal checkout/);
    assert.equal(checkout.window.location.href, '');
  }
});

test('missing PayPal configuration ends loading with a usable INR alternative', async () => {
  const checkout = makeCheckout({ clientId: '' });
  await checkout.currency('USD');
  assert.equal(checkout.scripts.length, 0);
  assert.match(checkout.text(), /PayPal is currently unavailable/);
  assert.doesNotMatch(checkout.text(), /Loading PayPal\.\.\./);
  await checkout.currency('INR');
  assert.match(checkout.text(), /Pay ₹149\.00/);
});

test('SDK script errors and timeouts end the spinner and permit another load attempt', async () => {
  const checkout = makeCheckout();
  await checkout.currency('USD');
  checkout.scripts[0].onerror();
  await checkout.flush();
  assert.match(checkout.text(), /Unable to load PayPal/);
  assert.doesNotMatch(checkout.text(), /Loading PayPal\.\.\./);
  assert.equal(checkout.scripts[0].removed, true);
  await checkout.retry();
  assert.equal(checkout.scripts.length, 2);
  for (const expire of checkout.timers.values()) expire();
  await checkout.flush();
  assert.doesNotMatch(checkout.text(), /Loading PayPal\.\.\./);
  await checkout.retry();
  await checkout.loaded();
  assert.equal(checkout.buttonInstances.length, 1);
});

test('a failed button render is closed and can render successfully on retry', async () => {
  const checkout = makeCheckout({ sdk: true, renderFailure: true });
  await checkout.currency('USD');
  assert.match(checkout.text(), /buttons failed to render/);
  assert.doesNotMatch(checkout.text(), /Loading PayPal\.\.\./);
  assert.equal(checkout.buttonInstances[0].closes, 1);
  assert.equal(checkout.host.children[0].children.length, 0);
  await checkout.retry();
  assert.equal(checkout.buttonInstances.length, 2);
  assert.doesNotMatch(checkout.text(), /buttons failed to render/);
});
