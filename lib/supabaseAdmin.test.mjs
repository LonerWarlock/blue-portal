import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const serviceKey = 'test-service-role-not-a-real-key';
const publicKey = 'test-public-not-a-real-key';
const userToken = `header.${Buffer.from(JSON.stringify({ sub: 'otp-user-a', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
const userBToken = 'request-user-b-token';
const originalFetch = globalThis.fetch;
const originalEnv = Object.fromEntries(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].map(key => [key, process.env[key]]));
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://account-isolation.example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = publicKey;
delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const { supabaseAdmin, createSupabaseAuthClient } = await import('./supabaseAdmin.ts');

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

function installMock() {
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || String(input));
    assert.equal(url.origin, 'https://account-isolation.example.invalid');
    const headers = new Headers(init.headers);
    const authorization = headers.get('Authorization');
    requests.push({ path: url.pathname, authorization, apiKey: headers.get('apikey') });
    if (url.pathname === '/auth/v1/verify') return Response.json({
      access_token: userToken, refresh_token: 'test-refresh-token', token_type: 'bearer',
      expires_in: 3600, user: { id: 'otp-user-a', email: 'a@example.invalid' },
    });
    if (url.pathname === '/auth/v1/user') return authorization === `Bearer ${userBToken}`
      ? Response.json({ id: 'request-user-b' })
      : Response.json({ msg: 'Invalid JWT', code: 'bad_jwt' }, { status: 401 });
    if (url.pathname === '/auth/v1/otp') return Response.json({});
    if (url.pathname === '/rest/v1/blue_profiles') return Response.json(
      authorization === `Bearer ${serviceKey}` ? [{ status: 'active', total_credits_purchased: 5 }] : []
    );
    if (url.pathname === '/rest/v1/wallets') return Response.json(
      authorization === `Bearer ${serviceKey}` ? [{ account_type: 'pro_payg', blue_credits: 4 }] : []
    );
    throw new Error(`Unexpected mocked request: ${url.pathname}`);
  };
  return requests;
}

test('OTP sessions cannot replace service-role authorization for another PAYG user', async () => {
  const requests = installMock();
  const otp = await supabaseAdmin.auth.verifyOtp({ email: 'a@example.invalid', token: '123456', type: 'email' });
  assert.equal(otp.error, null);
  assert.equal((await supabaseAdmin.auth.getSession()).data.session.access_token, userToken);
  const verifiedUser = await supabaseAdmin.auth.getUser(userBToken);
  assert.equal(verifiedUser.data.user.id, 'request-user-b');
  const profile = await supabaseAdmin.from('blue_profiles').select('status,total_credits_purchased').eq('user_id', 'request-user-b').maybeSingle();
  const wallet = await supabaseAdmin.from('wallets').select('account_type,blue_credits').eq('user_id', 'request-user-b').maybeSingle();
  assert.equal(profile.error, null);
  assert.equal(profile.data.status, 'active');
  assert.equal(wallet.data.account_type, 'pro_payg');
  assert.equal(wallet.data.blue_credits, 4);
  for (const request of requests.filter(item => item.path.startsWith('/rest/v1/'))) {
    assert.equal(request.authorization, `Bearer ${serviceKey}`);
  }
  assert.equal(requests.find(item => item.path === '/auth/v1/user').authorization, `Bearer ${userBToken}`);
});

test('request-scoped OTP clients do not share sessions or use the admin client', async () => {
  const requests = installMock();
  const first = createSupabaseAuthClient();
  const second = createSupabaseAuthClient();
  assert.notEqual(first, second);
  assert.notEqual(first, supabaseAdmin);
  assert.equal((await first.auth.verifyOtp({ email: 'a@example.invalid', token: '123456', type: 'email' })).error, null);
  assert.equal((await first.auth.getSession()).data.session.access_token, userToken);
  assert.equal((await second.auth.getSession()).data.session, null);
  assert.equal((await second.auth.signInWithOtp({ email: 'b@example.invalid' })).error, null);
  assert.equal(requests.find(item => item.path === '/auth/v1/otp').apiKey, publicKey);
  const profile = await supabaseAdmin.from('blue_profiles').select('status').eq('user_id', 'request-user-b').maybeSingle();
  assert.equal(profile.data.status, 'active');
  assert.equal(requests.at(-1).authorization, `Bearer ${serviceKey}`);
});

test('fixed database authorization cannot turn an invalid user session into verified access', async () => {
  const requests = installMock();
  const result = await supabaseAdmin.auth.getUser('invalid-user-token');
  assert.equal(result.data.user, null);
  assert.equal(result.error.status, 401);
  assert.equal(requests[0].authorization, 'Bearer invalid-user-token');
});

test('both OTP routes use a fresh auth client rather than authenticating on shared admin', async () => {
  for (const route of ['send-otp', 'verify-otp']) {
    const source = await readFile(new URL(`../app/api/auth/${route}/route.ts`, import.meta.url), 'utf8');
    assert.match(source, /const authClient = createSupabaseAuthClient\(\)/);
    assert.match(source, /authClient\.auth\./);
    assert.doesNotMatch(source, /supabaseAdmin\.auth\./);
  }
});
