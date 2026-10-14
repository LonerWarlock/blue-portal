const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Real handlers with isolated adapters: no live database, emails or payments.
function load(relativePath, adapters = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => name in adapters ? adapters[name] : require(name), exports);
  return exports;
}
const config = load('app/hackathon/config.ts');
const security = load('lib/paymentSecurity.ts');
const next = { NextResponse: {
  json: (data, options) => Response.json(data, options),
  redirect: (url, status = 303) => new Response(null, { status, headers: { Location: String(url) } }),
} };
function fixture(kind, configOverride = {}) {
  const calls = [], writes = [];
  const admin = { from(table) {
    calls.push(table);
    const result = { data: table === 'pending_registrations' ? {
      id: 'hack_test', form_data: { leaderFirstName: 'Test', leaderLastName: 'Participant',
        leaderEmail: 'test@example.invalid', teamName: 'Test Team', teamSize: 1 },
    } : null, error: null };
    return {
      select() { return this; }, eq() { return this; }, neq() { return this; },
      order() { return this; }, limit() { return this; },
      insert(value) { writes.push({ table, operation: 'insert', value }); return this; },
      delete() { writes.push({ table, operation: 'delete' }); return this; },
      maybeSingle: async () => result,
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    };
  } };
  const handler = load(`app/api/hackathon/payu/${kind}/route.ts`, {
    'next/server': next, '@/lib/supabaseAdmin': { supabaseAdmin: admin },
    '@/app/hackathon/config': { ...config, ...configOverride }, '@/lib/paymentSecurity': security,
    nodemailer: { createTransport() { throw new Error('Tests must not send email'); } },
  });
  return { handler, calls, writes };
}
function withCredentials(fn) {
  const names = ['PAYU_MERCHANT_KEY', 'PAYU_MERCHANT_SALT', 'NEXT_PUBLIC_SITE_URL', 'SMTP_USER', 'SMTP_PASS'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { PAYU_MERCHANT_KEY: 'fixture-key', PAYU_MERCHANT_SALT: 'fixture-salt',
    NEXT_PUBLIC_SITE_URL: 'https://test.invalid', SMTP_USER: '', SMTP_PASS: '' });
  return Promise.resolve().then(fn).finally(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  });
}
function callback(overrides = {}) {
  const data = { key: 'fixture-key', txnid: 'hack_test', amount: '1.00',
    productinfo: `${config.EVENT_NAME} - Hackathon Registration`, firstname: 'Test',
    email: 'test@example.invalid', status: 'success', mihpayid: 'fixture-transaction', ...overrides };
  data.hash = security.payuCallbackHash({ ...data,
    additionalCharges: data.additionalCharges || data.additional_charges || '',
  }, 'fixture-salt');
  return data;
}
function postCallback(handler, data) {
  return handler.POST(new Request('https://test.invalid/api/hackathon/payu/callback', {
    method: 'POST', body: new URLSearchParams(data),
  }));
}

test('UI, totals and PayU use ₹1 per person and the finite test deadline', () => {
  assert.equal(config.HACKATHON_FEE_PER_PERSON, 1);
  assert.equal(config.HACKATHON_FEE_PER_PERSON_STR, '₹1');
  for (let size = 1; size <= 4; size++) {
    assert.equal(config.getTeamFeeStr(size), `₹${size}`);
    assert.equal(config.getTeamFeePayU(size), `${size}.00`);
  }
  const deadline = config.PAYMENT_TESTING_DEADLINE.getTime();
  assert.equal(config.isHackathonRegistrationOpen(deadline - 1), true);
  assert.equal(config.isHackathonRegistrationOpen(deadline), false);
  assert.equal(config.isHackathonRegistrationOpen(deadline + 1), false);
  assert.equal(config.isHackathonRegistrationOpen(NaN), false);
  const page = fs.readFileSync(path.join(__dirname, '../app/hackathon/page.tsx'), 'utf8');
  assert.doesNotMatch(page, /₹100 per person/);
  assert.match(page, /Payment integration test:/);
  assert.match(page, /setIsDeadlinePassed\(!isHackathonRegistrationOpen\(\)\)/);
});

test('create-hash signs the server-owned ₹1 price, not a client-supplied amount', () => withCredentials(async () => {
  for (let teamSize = 1; teamSize <= 4; teamSize++) {
    const f = fixture('create-hash', { isHackathonRegistrationOpen: () => true });
    const response = await f.handler.POST(new Request('https://test.invalid/api/hackathon/payu/create-hash', {
      method: 'POST', body: JSON.stringify({ sessionId: 'hack_test', amount: 999,
        formData: { teamSize, amount: 999, leaderFirstName: 'Test', leaderEmail: 'test@example.invalid' } }),
    }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.amount, `${teamSize}.00`);
    assert.equal(data.hash, security.payuRequestHash(data, 'fixture-salt'));
    assert.equal(f.writes.length, 1);
  }
}));

test('expired registration and invalid team sizes cannot create payment sessions', () => withCredentials(async () => {
  for (const teamSize of [0, -1, 1.5, 5, 'invalid', undefined]) {
    const f = fixture('create-hash', { isHackathonRegistrationOpen: () => true });
    const response = await f.handler.POST(new Request('https://test.invalid/api/hackathon/payu/create-hash', {
      method: 'POST', body: JSON.stringify({ sessionId: 'hack_test', formData: { teamSize } }),
    }));
    assert.equal(response.status, 400);
    assert.equal(f.calls.length, 0);
  }
  const closed = fixture('create-hash', { isHackathonRegistrationOpen: () => false });
  const response = await closed.handler.POST(new Request('https://test.invalid/api/hackathon/payu/create-hash', {
    method: 'POST', body: JSON.stringify({ sessionId: 'hack_test', formData: { teamSize: 1 } }),
  }));
  assert.equal(response.status, 410);
  assert.equal(closed.calls.length, 0);
}));

test('bad, missing, tampered and wrong-merchant signatures fail before database access', () => withCredentials(async () => {
  const valid = callback();
  for (const data of [
    { ...valid, hash: '' }, { ...valid, hash: 'wrong' }, { ...valid, hash: '0'.repeat(128) },
    { ...valid, amount: '0.01' }, callback({ key: 'another-key' }), { ...valid, txnid: '' },
    callback({ productinfo: 'Unrelated subscription' }),
  ]) {
    const f = fixture('callback');
    assert.equal((await postCallback(f.handler, data)).status, 403);
    assert.equal(f.calls.length, 0);
  }
  for (const name of ['PAYU_MERCHANT_KEY', 'PAYU_MERCHANT_SALT']) {
    const saved = process.env[name];
    delete process.env[name];
    const f = fixture('callback');
    assert.equal((await postCallback(f.handler, valid)).status, 403);
    assert.equal(f.calls.length, 0);
    process.env[name] = saved;
  }
}));

test('genuine signed callbacks keep success, additional charges and raw email hashing', () => withCredentials(async () => {
  for (const overrides of [{}, { additionalCharges: '0.10' }, { additional_charges: '0.10' },
    { email: 'Test@Example.Invalid' }]) {
    const f = fixture('callback');
    const response = await postCallback(f.handler, callback(overrides));
    assert.equal(response.status, 303);
    assert.match(response.headers.get('Location'), /payment=success/);
    const saved = f.writes.find(write => write.table === 'hackathon_registrations' && write.operation === 'insert');
    assert.equal(saved.value.payment_amount, 1);
    assert.equal(saved.value.payment_status, 'success');
  }
}));

test('a signed failed payment never inserts a paid registration', () => withCredentials(async () => {
  const f = fixture('callback');
  const response = await postCallback(f.handler, callback({ status: 'failure' }));
  assert.match(response.headers.get('Location'), /payment=failed/);
  assert.equal(f.writes.some(write => write.operation === 'insert'), false);
}));
