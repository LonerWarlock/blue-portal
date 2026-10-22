import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as plans from './blueTeamsPlans.ts';

const nativeRequire = createRequire(import.meta.url);
const code = ts.transpileModule(await readFile(new URL('./blueTeamsCheckoutMode.ts', import.meta.url), 'utf8'),
  { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText;
const modeExports = {};
new Function('require','exports',code)((name)=>name === './blueTeamsPlans' ? plans : nativeRequire(name),modeExports);
const { getBlueTeamsCheckoutConfig, teamsPaymentGatewayReady, teamsSessionModeAllowed } = modeExports;

const keys = ['BLUE_TEAMS_TEST_MODE','BLUE_TEAMS_LIVE_CHECKOUT_ENABLED','NEXT_PUBLIC_PAYU_URL','PAYU_MERCHANT_KEY','PAYU_MERCHANT_SALT',
  'PAYPAL_ENV','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','NEXT_PUBLIC_PAYPAL_CLIENT_ID','NODE_ENV','VERCEL_ENV',
  'BLUE_TEAMS_LIVE_TEST_PRICE_ENABLED'];
function withEnv(values, run) {
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) { if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key]; }
  try { return run(); } finally { for (const key of keys) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; } }
}
const sandbox = {
  BLUE_TEAMS_TEST_MODE:'true', BLUE_TEAMS_LIVE_CHECKOUT_ENABLED:'false',
  NEXT_PUBLIC_PAYU_URL:'https://test.payu.in/_payment', PAYU_MERCHANT_KEY:'test-key', PAYU_MERCHANT_SALT:'test-salt',
  PAYPAL_ENV:'sandbox', PAYPAL_CLIENT_ID:'sandbox-client', PAYPAL_CLIENT_SECRET:'sandbox-secret', NEXT_PUBLIC_PAYPAL_CLIENT_ID:'sandbox-client',
};

test('sandbox checkout requires explicit opt-in and both sandbox gateways', () => withEnv(sandbox, () => {
  assert.deepEqual(getBlueTeamsCheckoutConfig(), { checkoutEnabled:true, testMode:true, liveTestPriceEnabled:false, payuAvailable:true, paypalAvailable:true });
  assert.equal(teamsSessionModeAllowed(true,'payu'),true); assert.equal(teamsSessionModeAllowed(true,'paypal'),true);
}));

test('test mode fails closed if either provider is pointed at live or lacks test credentials', () => {
  withEnv({ ...sandbox, NEXT_PUBLIC_PAYU_URL:'https://secure.payu.in/_payment' }, () => {
    assert.equal(getBlueTeamsCheckoutConfig().checkoutEnabled,false);
    assert.equal(teamsSessionModeAllowed(true,'payu'),false);
  });
  withEnv({ ...sandbox, PAYPAL_ENV:'live' }, () => {
    assert.equal(getBlueTeamsCheckoutConfig().checkoutEnabled,false);
    assert.equal(teamsSessionModeAllowed(true,'paypal'),false);
  });
  withEnv({ ...sandbox, PAYU_MERCHANT_SALT:'' }, () => assert.equal(getBlueTeamsCheckoutConfig().checkoutEnabled,false));
});

test('the live Business ₹1 launch test is explicit and production-only', () => {
  withEnv({ ...sandbox, BLUE_TEAMS_TEST_MODE:'false', BLUE_TEAMS_LIVE_CHECKOUT_ENABLED:'true',
    BLUE_TEAMS_LIVE_TEST_PRICE_ENABLED:'true',
    NEXT_PUBLIC_PAYU_URL:'https://secure.payu.in/_payment', PAYPAL_ENV:'live', NODE_ENV:'production', VERCEL_ENV:'production' }, () => {
    assert.equal(getBlueTeamsCheckoutConfig().liveTestPriceEnabled, true);
  });
  withEnv({ ...sandbox, BLUE_TEAMS_TEST_MODE:'false', BLUE_TEAMS_LIVE_CHECKOUT_ENABLED:'true',
    BLUE_TEAMS_LIVE_TEST_PRICE_ENABLED:'true', NEXT_PUBLIC_PAYU_URL:'https://secure.payu.in/_payment', PAYPAL_ENV:'live', NODE_ENV:'production', VERCEL_ENV:'preview' }, () => {
    assert.equal(getBlueTeamsCheckoutConfig().liveTestPriceEnabled, false);
  });
});

test('live charges remain off by default and must explicitly match a production gateway', () => {
  withEnv({ ...sandbox, BLUE_TEAMS_TEST_MODE:'false', BLUE_TEAMS_LIVE_CHECKOUT_ENABLED:'false' }, () => {
    assert.equal(getBlueTeamsCheckoutConfig().checkoutEnabled,false);
    assert.equal(teamsPaymentGatewayReady('paypal',false),false);
  });
  withEnv({ ...sandbox, BLUE_TEAMS_TEST_MODE:'false', BLUE_TEAMS_LIVE_CHECKOUT_ENABLED:'true',
    NEXT_PUBLIC_PAYU_URL:'https://secure.payu.in/_payment', PAYPAL_ENV:'live', NODE_ENV:'production', VERCEL_ENV:'production' }, () => {
    assert.equal(teamsSessionModeAllowed(false,'payu'),true);
    assert.equal(teamsSessionModeAllowed(false,'paypal'),true);
  });
  withEnv({ ...sandbox, BLUE_TEAMS_TEST_MODE:'false', BLUE_TEAMS_LIVE_CHECKOUT_ENABLED:'true',
    NEXT_PUBLIC_PAYU_URL:'https://secure.payu.in/_payment', PAYPAL_ENV:'live', NODE_ENV:'production', VERCEL_ENV:'preview' }, () => {
    assert.equal(getBlueTeamsCheckoutConfig().checkoutEnabled,false);
    assert.equal(teamsSessionModeAllowed(false,'paypal'),false);
  });
});
