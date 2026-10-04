// Execute the real PayPal routes with isolated database/auth/provider adapters.
// These tests create no network requests, orders, payments or real accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as plans from './blueSubscriptionPlans.ts';
import { moneyEquals, safeInternalUrl } from './paymentSecurity.ts';

const nativeRequire = createRequire(import.meta.url);
const user = { id: 'test-user', email: 'billing@example.invalid' };
const next = { NextResponse: {
  json: (body, options = {}) => Response.json(body, options),
  redirect: (url, status = 303) => new Response(null, { status, headers: { Location: String(url) } }),
} };

function fixture(cycle = 'monthly', options = {}) {
  const session = {
    id: 'test-session', user_id: user.id, plan: 'blue', billing_cycle: cycle,
    status: 'pending', expires_at: new Date(Date.now() + 600000).toISOString(), metadata: { email: user.email },
    ...options.session,
  };
  const rows = { checkout_sessions: [session], wallets: [{ user_id: user.id, balance: options.balance ?? 200 }], payment_orders: [] };
  const writes = [], rpcs = [], created = [], captured = [], retrieved = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: options.unauthorized ? null : user }, error: null }) },
    from(table) {
      const filters = [];
      let operation, value;
      const chain = {
        select() { return this; }, eq(key, expected) { filters.push([key, expected]); return this; },
        insert(input) { operation = 'insert'; value = input; return this; },
        update(input) { operation = 'update'; value = input; return this; },
        async single() { return execute(); }, async maybeSingle() { return execute(); },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
      };
      function execute() {
        const matching = (rows[table] || []).filter(row => filters.every(([key, expected]) => row[key] === expected));
        if (operation) {
          writes.push({ table, operation, value, filters });
          if (operation === 'insert') {
            if (table === 'payment_orders' && rows.payment_orders.length) return { data: null, error: { message: 'Duplicate checkout' } };
            const row = { id: 'test-payment-order', ...value };
            rows[table].push(row);
            return { data: row, error: null };
          }
          if (!matching.length) return { data: null, error: { message: 'No pending record to update' } };
          for (const row of matching) Object.assign(row, value);
        }
        return { data: matching[0] || null, error: null };
      }
      return chain;
    },
    async rpc(name, args) {
      rpcs.push({ name, args });
      if (options.failSettlement) return { data: null, error: { message: 'Temporary database error' } };
      session.status = 'completed';
      rows.payment_orders[0].status = 'completed';
      rows.payment_orders[0].provider_transaction_id = args.provider_transaction_id_param;
      return { data: { status: 'completed' }, error: null };
    },
  };
  const provider = {
    async createPaypalOrder(input) {
      created.push(input);
      return { orderId: `ORDER-${created.length}`, approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=ORDER-${created.length}` };
    },
    async capturePaypalOrder(orderId) {
      captured.push(orderId);
      if (options.captureError) throw new Error('ORDER_ALREADY_CAPTURED');
      return captureEvidence();
    },
    async getPaypalOrder(orderId) { retrieved.push(orderId); return captureEvidence(); },
  };
  function captureEvidence() {
    const order = rows.payment_orders[0];
    return {
      orderId: order.provider_order_id, status: 'COMPLETED', captureStatus: 'COMPLETED',
      captureId: 'CAPTURE-1', purchaseUnitCount: 1, captureCount: 1,
      grossAmount: order.amount, currency: 'USD', customId: order.custom_id,
      invoiceId: order.metadata.expected_invoice_id, payerEmail: user.email,
      ...options.capture,
    };
  }
  function bind(redeemedImr = 0) {
    const amount = plans.bluePlanPriceUsd(cycle, redeemedImr);
    session.metadata = {
      email: user.email, return_url: 'https://test.invalid/console', payment_provider: 'paypal',
      expected_order_id: 'ORDER-1', expected_amount: amount, expected_currency: 'USD',
      expected_custom_id: 'ppc_test_nonce', expected_invoice_id: 'ppc_test_nonce', txnid: 'ppc_test_nonce',
      capture_nonce_required: true, redeemed_imr: redeemedImr,
    };
    rows.payment_orders.push({
      id: 'test-payment-order', checkout_session_id: session.id, user_id: user.id,
      product_sku: plans.BLUE_SUBSCRIPTION_PLANS[cycle].sku, gateway: 'paypal', currency: 'USD',
      amount, redeemed_imr: redeemedImr, provider_order_id: 'ORDER-1', custom_id: 'ppc_test_nonce',
      status: 'pending', expires_at: session.expires_at,
      metadata: { expected_custom_id: 'ppc_test_nonce', expected_invoice_id: 'ppc_test_nonce' },
    });
  }
  return { db, options, rows, session, writes, rpcs, created, captured, retrieved, provider, bind };
}

async function route(kind, fixture) {
  const source = await readFile(new URL(`../app/api/checkout/paypal/${kind}/route.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const modules = {
    'next/server': next, '@/lib/supabaseAdmin': { supabaseAdmin: fixture.db },
    '@/lib/paypal': fixture.provider, '@/lib/blueSubscriptionPlans': plans,
    '@/lib/paymentSecurity': { moneyEquals, safeInternalUrl },
    '@/lib/bluePayg': { getBearerToken: request => request.headers.get('authorization')?.slice(7) || null },
    '@/lib/trafficControl': {
      checkRateLimit: async () => ({ allowed: !fixture.options.rateBlocked, configured: true }),
      rateLimitHeaders: () => ({ 'Retry-After': '60' }), requestIp: () => 'test-ip',
    },
  };
  new Function('require', 'exports', code)(name => name in modules ? modules[name] : nativeRequire(name), exports);
  return exports;
}
function createRequest(body = {}, token = 'test-token') {
  return new Request('https://test.invalid/api/checkout/paypal/create-order', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ sessionId: 'test-session', ...body }),
  });
}
function callbackRequest(query = {}) {
  const params = new URLSearchParams({ session_id: 'test-session', token: 'ORDER-1', txnid: 'ppc_test_nonce', ...query });
  return new Request(`https://test.invalid/api/checkout/paypal/capture?${params}`);
}
function paymentStatus(response) { return new URL(response.headers.get('Location')).searchParams.get('payment'); }

test('PayPal uses the stored cycle, trusted USD amount and cycle SKU for every duration', async () => {
  for (const cycle of ['monthly', 'quarterly', 'yearly']) {
    const f = fixture(cycle), handler = await route('create-order', f);
    const response = await handler.POST(createRequest({ billing_cycle: 'monthly', amount: '0.01', currency: 'INR', duration_days: 9999, redeemedImr: 100, returnUrl: 'https://evil.invalid' }));
    assert.equal(response.status, 200);
    const result = await response.json(), stored = f.rows.payment_orders[0];
    assert.equal(f.created[0].amount, plans.bluePlanPriceUsd(cycle, 100));
    assert.equal(f.created[0].currency, 'USD');
    assert.match(f.created[0].description, new RegExp(`${plans.BLUE_SUBSCRIPTION_PLANS[cycle].days} days`));
    assert.equal(stored.product_sku, plans.BLUE_SUBSCRIPTION_PLANS[cycle].sku);
    assert.equal(stored.amount, plans.bluePlanPriceUsd(cycle, 100));
    assert.equal(stored.metadata.duration_days, plans.BLUE_SUBSCRIPTION_PLANS[cycle].days);
    assert.equal(f.session.metadata.price_inr, plans.bluePlanPriceInr(cycle, 100));
    assert.equal(f.session.metadata.expected_amount, stored.amount);
    assert.equal(f.session.metadata.capture_nonce_required, true);
    assert.equal(new URL(f.created[0].returnUrl).searchParams.get('txnid'), result.txnid);
    assert.equal(f.created[0].cancelUrl, 'https://test.invalid/console');
  }
});

test('identical order creation retries reuse the bound provider order', async () => {
  const f = fixture('quarterly'), handler = await route('create-order', f);
  const first = await (await handler.POST(createRequest())).json();
  const second = await (await handler.POST(createRequest())).json();
  assert.deepEqual(second, first);
  assert.equal(f.created.length, 1);
  assert.equal(f.rows.payment_orders.length, 1);
});

test('IMR changes replace only pending orders with a new trusted amount', async () => {
  const f = fixture('yearly'), handler = await route('create-order', f);
  assert.equal((await handler.POST(createRequest())).status, 200);
  assert.equal((await handler.POST(createRequest({ redeemedImr: 10 }))).status, 200);
  assert.equal(f.rows.payment_orders.length, 1);
  assert.equal(f.rows.payment_orders[0].provider_order_id, 'ORDER-2');
  assert.equal(f.rows.payment_orders[0].amount, plans.bluePlanPriceUsd('yearly', 10));
  const orderWrite = f.writes.filter(write => write.table === 'payment_orders')[1];
  assert.ok(orderWrite.filters.some(([key, value]) => key === 'status' && value === 'pending'));
});

test('creation rejects unsupported cycles, invalid/insufficient IMR and expired sessions before provider calls', async () => {
  const cases = [
    ['weekly', {}, {}, 400], ['__proto__', {}, {}, 400], ['yearly', {}, { redeemedImr: 101 }, 400],
    ['monthly', {}, { redeemedImr: -1 }, 400], ['monthly', { balance: 9 }, { redeemedImr: 10 }, 400],
    ['yearly', { session: { expires_at: new Date(Date.now() - 1000).toISOString() } }, {}, 409],
    ['monthly', { session: { expires_at: 'invalid' } }, {}, 409],
  ];
  for (const [cycle, options, body, status] of cases) {
    const f = fixture(cycle, options), handler = await route('create-order', f);
    assert.equal((await handler.POST(createRequest(body))).status, status);
    assert.equal(f.created.length, 0);
    assert.equal(f.writes.length, 0);
  }
});

test('creation enforces authentication, session ownership and rate limits', async () => {
  const cases = [
    [{}, '', 401], [{ unauthorized: true }, 'token', 401],
    [{ session: { user_id: 'other-user' } }, 'token', 403], [{ rateBlocked: true }, 'token', 429],
  ];
  for (const [options, token, status] of cases) {
    const f = fixture('yearly', options), handler = await route('create-order', f);
    assert.equal((await handler.POST(createRequest({}, token))).status, status);
    assert.equal(f.created.length, 0);
    assert.equal(f.writes.length, 0);
  }
});

test('paused checkout prevents PayPal order creation', async () => {
  const previous = process.env.DISABLE_CHECKOUT;
  process.env.DISABLE_CHECKOUT = 'true';
  try {
    const f = fixture('yearly'), handler = await route('create-order', f);
    assert.equal((await handler.POST(createRequest())).status, 503);
    assert.equal(f.created.length, 0);
  } finally {
    if (previous === undefined) delete process.env.DISABLE_CHECKOUT;
    else process.env.DISABLE_CHECKOUT = previous;
  }
});

test('verified completed captures reach atomic settlement for every cycle exactly once on replay', async () => {
  for (const cycle of ['monthly', 'quarterly', 'yearly']) {
    const f = fixture(cycle); f.bind(100);
    const handler = await route('capture', f);
    assert.equal(paymentStatus(await handler.GET(callbackRequest())), 'success');
    assert.equal(paymentStatus(await handler.GET(callbackRequest())), 'success');
    assert.equal(f.captured.length, 1);
    assert.equal(f.rpcs.length, 1);
    assert.equal(f.rpcs[0].name, 'complete_blue_subscription_checkout');
    assert.equal(f.rpcs[0].args.provider_transaction_id_param, 'CAPTURE-1');
    assert.equal(f.rpcs[0].args.provider_order_id_param, 'ORDER-1');
  }
});

test('wrong token/nonce, forged price/currency/SKU or owner cannot capture or activate access', async () => {
  const mutations = [
    f => { f.query = { token: 'ANOTHER-ORDER' }; },
    f => { f.query = { txnid: 'another-nonce' }; },
    f => { f.query = { txnid: '' }; },
    f => { f.rows.payment_orders[0].product_sku = 'blue_monthly'; },
    f => { f.rows.payment_orders[0].user_id = 'other-user'; },
    f => { f.rows.payment_orders[0].amount = '0.01'; f.session.metadata.expected_amount = '0.01'; },
    f => { f.rows.payment_orders[0].currency = 'INR'; },
    f => { f.session.metadata.expected_currency = 'INR'; },
    f => { f.rows.payment_orders[0].custom_id = 'other-nonce'; },
    f => { f.rows.payment_orders[0].metadata.expected_invoice_id = 'other-invoice'; },
    f => { f.session.billing_cycle = 'weekly'; },
  ];
  for (const mutate of mutations) {
    const f = fixture('yearly'); f.bind(); mutate(f);
    const handler = await route('capture', f);
    assert.equal(paymentStatus(await handler.GET(callbackRequest(f.query))), 'invalid');
    assert.equal(f.captured.length, 0);
    assert.equal(f.retrieved.length, 0);
    assert.equal(f.rpcs.length, 0);
  }
});

test('completed replays still reject a different order token or callback nonce', async () => {
  const f = fixture('yearly'); f.bind();
  f.session.status = f.rows.payment_orders[0].status = 'completed';
  const handler = await route('capture', f);
  assert.equal(paymentStatus(await handler.GET(callbackRequest({ token: 'ANOTHER-ORDER' }))), 'invalid');
  assert.equal(paymentStatus(await handler.GET(callbackRequest({ txnid: 'other-nonce' }))), 'invalid');
  assert.equal(f.captured.length, 0);
  assert.equal(f.rpcs.length, 0);
});

test('legacy monthly SDK callbacks retain their nonce-free return compatibility', async () => {
  const f = fixture('monthly'); f.bind(10);
  delete f.session.metadata.capture_nonce_required;
  const handler = await route('capture', f);
  assert.equal(paymentStatus(await handler.GET(callbackRequest({ txnid: '' }))), 'success');
});

test('unverified, partial, ambiguous or mismatched provider captures never activate access', async () => {
  for (const capture of [
    { status: 'APPROVED' }, { captureStatus: 'PENDING' }, { captureId: undefined },
    { orderId: 'ANOTHER-ORDER' }, { currency: 'INR' }, { grossAmount: '0.01' },
    { customId: 'another-custom' }, { invoiceId: 'another-invoice' },
    { purchaseUnitCount: 2 }, { captureCount: 2 },
  ]) {
    const f = fixture('quarterly', { capture }); f.bind();
    const handler = await route('capture', f);
    assert.equal(paymentStatus(await handler.GET(callbackRequest())), 'invalid');
    assert.equal(f.rpcs.length, 0);
    assert.equal(f.session.status, 'pending');
  }
});

test('capture exceptions retrieve completed provider evidence and recover settlement', async () => {
  const f = fixture('yearly', { captureError: true }); f.bind();
  const handler = await route('capture', f);
  assert.equal(paymentStatus(await handler.GET(callbackRequest())), 'success');
  assert.deepEqual(f.captured, ['ORDER-1']);
  assert.deepEqual(f.retrieved, ['ORDER-1']);
  assert.equal(f.rpcs.length, 1);
});

test('a failed DB settlement retains pending records and a later captured-order retry can finish', async () => {
  const f = fixture('quarterly', { failSettlement: true }); f.bind();
  const handler = await route('capture', f);
  assert.equal(paymentStatus(await handler.GET(callbackRequest())), 'failed');
  assert.equal(f.session.status, 'pending');
  assert.equal(f.rows.payment_orders[0].status, 'pending');
  f.options.failSettlement = false;
  f.options.captureError = true;
  assert.equal(paymentStatus(await handler.GET(callbackRequest())), 'success');
  assert.equal(f.retrieved.length, 1);
  assert.equal(f.rpcs.length, 2);
});

test('expired callbacks only retrieve already-completed orders and never initiate capture', async () => {
  for (const completed of [true, false]) {
    const f = fixture('yearly', { session: { expires_at: new Date(Date.now() - 1000).toISOString() },
      capture: completed ? {} : { status: 'APPROVED', captureStatus: undefined, captureId: undefined } });
    f.bind();
    const handler = await route('capture', f);
    assert.equal(paymentStatus(await handler.GET(callbackRequest())), completed ? 'success' : 'invalid');
    assert.equal(f.captured.length, 0);
    assert.equal(f.retrieved.length, 1);
    assert.equal(f.rpcs.length, completed ? 1 : 0);
  }
});

test('capture rate limits fail before contacting PayPal and leave the checkout pending', async () => {
  const f = fixture('yearly', { rateBlocked: true }); f.bind();
  const handler = await route('capture', f);
  assert.equal(paymentStatus(await handler.GET(callbackRequest())), 'failed');
  assert.equal(f.captured.length, 0);
  assert.equal(f.rpcs.length, 0);
  assert.equal(f.session.status, 'pending');
});
