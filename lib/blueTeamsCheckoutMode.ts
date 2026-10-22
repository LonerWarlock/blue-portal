import { BLUE_TEAMS_TEST_PRICE_INR, BLUE_TEAMS_TEST_PRICE_USD } from './blueTeamsPlans';

export type BlueTeamsGateway = 'payu' | 'paypal';

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function payuUrl() {
  return process.env.NEXT_PUBLIC_PAYU_URL?.trim() || 'https://secure.payu.in/_payment';
}

export function isPayUTestEnvironment(): boolean {
  try { const url = new URL(payuUrl()); return url.protocol === 'https:' && url.hostname === 'test.payu.in'; } catch { return false; }
}

export function isPayULiveEnvironment(): boolean {
  try { const url = new URL(payuUrl()); return url.protocol === 'https:' && url.hostname === 'secure.payu.in'; } catch { return false; }
}

export function isPaypalTestEnvironment(): boolean {
  return (process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase() !== 'live';
}

export function isPaypalLiveEnvironment(): boolean {
  return (process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase() === 'live';
}

export function teamsPaymentGatewayReady(gateway: BlueTeamsGateway, testMode: boolean): boolean {
  if (gateway === 'payu') {
    const credentialsReady = Boolean(process.env.PAYU_MERCHANT_KEY?.trim() && process.env.PAYU_MERCHANT_SALT?.trim());
    return credentialsReady && (testMode ? isPayUTestEnvironment() : isPayULiveEnvironment());
  }
  const credentialsReady = Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim()
    && process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim());
  return credentialsReady && (testMode ? isPaypalTestEnvironment() : isPaypalLiveEnvironment());
}

function liveCheckoutExplicitlyEnabled(): boolean {
  const requested = isTrue(process.env.BLUE_TEAMS_LIVE_CHECKOUT_ENABLED);
  if (!requested || process.env.NODE_ENV !== 'production') return false;
  // Vercel preview/development deployments must never inherit live checkout.
  return !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production';
}

/** A temporary public ₹1 Business launch check, enabled only in Production. */
export function blueTeamsLiveTestPriceEnabled(): boolean {
  return liveCheckoutExplicitlyEnabled()
    && isTrue(process.env.BLUE_TEAMS_LIVE_TEST_PRICE_ENABLED);
}

export function getBlueTeamsCheckoutConfig() {
  const requestedTestMode = isTrue(process.env.BLUE_TEAMS_TEST_MODE);
  const testMode = requestedTestMode
    && !liveCheckoutExplicitlyEnabled()
    && teamsPaymentGatewayReady('payu', true)
    && teamsPaymentGatewayReady('paypal', true);
  const liveRequested = !requestedTestMode && liveCheckoutExplicitlyEnabled();
  const livePayu = liveRequested && teamsPaymentGatewayReady('payu', false);
  const livePaypal = liveRequested && teamsPaymentGatewayReady('paypal', false);
  const liveMode = livePayu || livePaypal;
  return {
    checkoutEnabled: testMode || liveMode,
    testMode,
    liveTestPriceEnabled: liveMode && blueTeamsLiveTestPriceEnabled(),
    payuAvailable: testMode || livePayu,
    paypalAvailable: testMode || livePaypal,
  };
}

export function teamsSessionModeAllowed(testMode: boolean, gateway: BlueTeamsGateway): boolean {
  if (testMode) {
    return process.env.BLUE_TEAMS_TEST_MODE?.trim().toLowerCase() === 'true'
      && !liveCheckoutExplicitlyEnabled()
      && teamsPaymentGatewayReady(gateway, true);
  }
  return liveCheckoutExplicitlyEnabled()
    && teamsPaymentGatewayReady(gateway, false);
}

export function expectedTeamsTestPrices() {
  return { inr: BLUE_TEAMS_TEST_PRICE_INR, usd: BLUE_TEAMS_TEST_PRICE_USD };
}
