const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const ts = require('typescript');
function load(file, adapters = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => name in adapters ? adapters[name] : require(name), exports);
  return exports;
}
const origins = load('lib/paymentOrigin.ts');
const security = load('lib/paymentSecurity.ts');
const next = { NextResponse: { json: (data, options) => Response.json(data, options),
  redirect: (url, status = 303) => new Response(null, { status, headers: { Location: String(url) } }) } };
const status = response => new URL(response.headers.get('Location')).searchParams.get('payment');
function fixture(kind, options = {}) {
  const paid = { id: 'payment', provider_txnid: 'bcp_test', payment_provider: kind.includes('paypal') ? 'paypal' : 'payu',
    currency: kind.includes('paypal') ? 'USD' : 'INR', status: 'pending', credits_purchased: 10,
    metadata: { expected_key: 'test-key', expected_amount: '1.00', expected_productinfo: 'Test Credits',
      expected_firstname: 'Test', expected_email: 'TEST@example.invalid', return_url: 'https://blue-by-imergene.vercel.app/console',
      paypal_order_id: 'ORDER-1', usd_amount: 1, expected_custom_id: 'bcp_test', expected_invoice_id: 'bcp_test' },
    ...options.payment };
  const calls = [], writes = [], captures = [], reads = [];
  let activations = 0;
  const admin = { from() {
    calls.push('read');
    return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: paid, error: null }),
      update(value) { writes.push(value); return this; }, then(resolve) { return Promise.resolve({ error: null }).then(resolve); } };
  }, async rpc(name) {
    calls.push(name);
    if (options.failSettlement) return { error: { message: 'Temporary write failure' } };
    if (paid.status !== 'completed') { activations++; paid.status = 'completed'; }
    return { data: { credits: 10 }, error: null };
  } };
  const evidence = () => ({ orderId: 'ORDER-1', status: 'COMPLETED', captureStatus: 'COMPLETED',
    captureId: 'CAPTURE-1', purchaseUnitCount: 1, captureCount: 1, grossAmount: '1.00', currency: 'USD',
    customId: 'bcp_test', invoiceId: 'bcp_test', ...options.evidence });
  const handler = load(`app/api/blue-pro/${kind}/route.ts`, {
    'next/server': next, '@/lib/supabaseAdmin': { supabaseAdmin: admin }, '@/lib/paymentOrigin': origins,
    '@/lib/paymentSecurity': security, '@/lib/paypal': {
      capturePaypalOrder: async id => { captures.push(id); if (options.alreadyCaptured) throw Error('ORDER_ALREADY_CAPTURED'); return evidence(); },
      getPaypalOrder: async id => { reads.push(id); return evidence(); },
    },
  });
  return { handler, paid, options, calls, writes, captures, reads, activations: () => activations };
}
function payuData(overrides = {}) {
  const data = { key: 'test-key', txnid: 'bcp_test', amount: '1.00', productinfo: 'Test Credits',
    firstname: 'Test', email: 'TEST@example.invalid', status: 'success', ...overrides };
  return { ...data, hash: security.payuCallbackHash(data, 'test-salt') };
}
const post = (handler, data) => handler.POST(new Request('https://blue.imergene.in/api/blue-pro/payu/callback', {
  method: 'POST', body: new URLSearchParams(data),
}));
const get = (handler, token = 'ORDER-1') => handler.GET(new Request(`https://blue.imergene.in/api/blue-pro/paypal/capture?txnid=bcp_test&token=${token}`));
async function credentials(fn) {
  const names = ['PAYU_MERCHANT_KEY', 'PAYU_MERCHANT_SALT', 'NEXT_PUBLIC_SITE_URL'];
  const old = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { PAYU_MERCHANT_KEY: 'test-key', PAYU_MERCHANT_SALT: 'test-salt',
    NEXT_PUBLIC_SITE_URL: 'https://blue-by-imergene.vercel.app' });
  try { await fn(); } finally { for (const name of names) {
    if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name];
  } }
}

test('payment origin ignores retired configuration and untrusted hosts, preserving loopback development', () => {
  for (const input of [undefined, 'https://blue.imergene.in/api', 'https://blue-by-imergene.vercel.app/api', 'https://attacker.invalid']) {
    assert.equal(origins.paymentSiteOrigin(input), 'https://blue.imergene.in');
  }
  assert.equal(origins.paymentSiteOrigin('http://localhost:3005/api'), 'http://localhost:3005');
});
test('reverse hash matches PayU documented field order including UDFs and charge aliases', () => {
  const data = { status: 'success', key: 'key', txnid: 'txn', amount: '1.00', productinfo: 'Product',
    firstname: ' Test ', email: 'TEST@example.invalid', udf1: 'one', udf5: 'five', additional_charges: '0.10' };
  const expected = createHash('sha512').update('0.10|salt|success||||||five||||one|TEST@example.invalid| Test |Product|1.00|txn|key').digest('hex');
  assert.equal(security.payuCallbackHash(data, 'salt'), expected);
  const form = new FormData(); for (const [key, value] of Object.entries(data)) form.set(key, value);
  assert.equal(security.parsePayuForm(form).email, data.email);
  assert.equal(security.parsePayuForm(form).firstname, data.firstname);
});
test('PAYG PayU retains a captured payment through DB failure and activates only once on retry', () => credentials(async () => {
  const f = fixture('payu/callback', { failSettlement: true });
  const first = await post(f.handler, payuData({ additional_charges: '0.10', udf1: 'context' }));
  assert.equal(status(first), 'pending');
  assert.equal(new URL(first.headers.get('Location')).origin, 'https://blue.imergene.in');
  assert.equal(f.writes.length, 0);
  f.options.failSettlement = false;
  assert.equal(status(await post(f.handler, payuData())), 'success');
  assert.equal(status(await post(f.handler, payuData())), 'success');
  assert.equal(f.activations(), 1);
}));
test('PAYG PayU invalid signatures and wrong amounts never activate credits', () => credentials(async () => {
  for (const data of [{ ...payuData(), hash: 'invalid' }, payuData({ amount: '0.01' }), payuData({ key: 'other' })]) {
    const f = fixture('payu/callback');
    assert.equal(status(await post(f.handler, data)), 'invalid');
    assert.equal(f.activations(), 0);
  }
}));
test('PAYG PayPal rejects another order token before capture, including completed replays', async () => {
  for (const payment of [{}, { status: 'completed' }]) {
    const f = fixture('paypal/capture', { payment });
    assert.equal(status(await get(f.handler, 'OTHER-ORDER')), 'invalid');
    assert.equal(f.captures.length, 0);
  }
});
test('PAYG PayPal reconciles already-captured orders and retains pending state after DB failure', async () => {
  const f = fixture('paypal/capture', { alreadyCaptured: true, failSettlement: true });
  assert.equal(status(await get(f.handler)), 'pending');
  assert.equal(f.writes.length, 0);
  f.options.failSettlement = false;
  assert.equal(status(await get(f.handler)), 'success');
  assert.equal(status(await get(f.handler)), 'success');
  assert.equal(f.activations(), 1);
  assert.equal(f.captures.length, 2);
  assert.equal(f.reads.length, 2);
});
test('PAYG PayPal wrong amount, currency, capture or transaction binding cannot activate', async () => {
  for (const evidence of [{ grossAmount: '0.01' }, { currency: 'INR' }, { orderId: 'OTHER' },
    { customId: 'other' }, { invoiceId: 'other' }, { captureCount: 2 }, { captureId: '' }]) {
    const f = fixture('paypal/capture', { evidence });
    assert.equal(status(await get(f.handler)), 'invalid');
    assert.equal(f.activations(), 0);
  }
});
test('payment UI never promises no debit and exposes confirmation-pending state', () => {
  for (const file of ['app/hackathon/page.tsx', 'app/console/page.tsx']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /No amount has been deducted|wallet balance has not been debited/);
    assert.match(source, /Payment confirmation pending/);
    assert.match(source, /do not pay again/i);
  }
});
