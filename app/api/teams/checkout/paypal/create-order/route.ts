import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createPaypalOrder } from '@/lib/paypal';
import { getBearerToken } from '@/lib/bluePayg';
import { checkRateLimit, rateLimitHeaders, requestIp } from '@/lib/trafficControl';
import { moneyEquals, safeInternalUrl } from '@/lib/paymentSecurity';
import { paymentSiteOrigin } from '@/lib/paymentOrigin';
import { BLUE_TEAMS_LIVE_TEST_TIER, getBlueTeamsPlan, blueTeamsCheckoutAmount, getBlueTeamsCheckoutQuote, getBlueTeamsTierFromCheckoutPlan } from '@/lib/blueTeamsPlans';
import { blueTeamsLiveTestPriceEnabled, teamsSessionModeAllowed } from '@/lib/blueTeamsCheckoutMode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (String(process.env.DISABLE_CHECKOUT || '').toLowerCase() === 'true') return NextResponse.json({ error: 'Checkout is temporarily paused.' }, { status: 503 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.sessionId !== 'string' || !body.sessionId.trim()) return NextResponse.json({ error: 'Missing checkout session.' }, { status: 400 });
    const appliedImr = Number(body.redeemedImr ?? 0);
    if (!Number.isFinite(appliedImr) || appliedImr < 0 || appliedImr > 100) {
      return NextResponse.json({ error: 'Invalid IMR amount. You can apply between 0 and 100 IMR.' }, { status: 400 });
    }
    if (!supabaseAdmin) return NextResponse.json({ error: 'Checkout is temporarily unavailable.' }, { status: 503 });
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const limits = await Promise.all([
      checkRateLimit('teams:paypal:user', auth.user.id, { limit: 8, windowSeconds: 10 * 60 }),
      checkRateLimit('teams:paypal:ip', requestIp(request), { limit: 16, windowSeconds: 10 * 60 }),
    ]);
    const blocked = limits.find(result => !result.allowed);
    if (blocked) return NextResponse.json({ error: 'Too many payment attempts. Please wait and try again.' }, { status: blocked.configured ? 429 : 503, headers: rateLimitHeaders(blocked) });

    const { data: session, error } = await supabaseAdmin.from('checkout_sessions').select('*').eq('id', body.sessionId).single();
    if (error || !session) return NextResponse.json({ error: 'Checkout session not found.' }, { status: 404 });
    if (session.user_id !== auth.user.id) return NextResponse.json({ error: 'Checkout session does not belong to this user.' }, { status: 403 });
    const tier = getBlueTeamsTierFromCheckoutPlan(session.plan);
    const plan = getBlueTeamsPlan(tier);
    const testMode = session.metadata?.blue_teams_test_mode === true;
    const liveTestMode = session.metadata?.blue_teams_live_test_mode === true;
    const testPrice = testMode || liveTestMode;
    if (!tier || !plan || session.billing_cycle !== 'monthly' || session.metadata?.product_sku !== plan.sku) return NextResponse.json({ error: 'Unsupported team checkout.' }, { status: 400 });
    if (testMode && liveTestMode) return NextResponse.json({ error: 'This checkout has an invalid test configuration.' }, { status: 400 });
    if (liveTestMode && (tier !== BLUE_TEAMS_LIVE_TEST_TIER || !blueTeamsLiveTestPriceEnabled())) {
      return NextResponse.json({ error: 'The temporary live launch test is no longer available.' }, { status: 403 });
    }
    if (!teamsSessionModeAllowed(testMode, 'paypal')) return NextResponse.json({ error: 'PayPal is not configured for this checkout mode.' }, { status: 503 });
    if (testPrice && appliedImr > 0) return NextResponse.json({ error: 'IMR credits are not used for this $0.01 launch test.' }, { status: 400 });
    const expiresAt = new Date(session.expires_at).getTime();
    if (session.status !== 'pending' || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return NextResponse.json({ error: 'Checkout session has expired. Please start again.' }, { status: 409 });
    const preflight = await supabaseAdmin.rpc('validate_blue_teams_checkout', {session_id_param:session.id,currency_param:'USD'});
    if (preflight.error) return NextResponse.json({error:'Your plan or payment quote changed. Return to Teams and review the current price before paying.'},{status:409});

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets').select('balance').eq('user_id', session.user_id).single();
    const balance = Number(wallet?.balance);
    if (walletError || !wallet || !Number.isFinite(balance)) return NextResponse.json({ error: 'Could not fetch wallet balance.' }, { status: 500 });
    if (appliedImr > balance) return NextResponse.json({ error: 'Insufficient IMR balance.' }, { status: 400 });
    const quote = getBlueTeamsCheckoutQuote(session.metadata);
    if (quote?.mode === 'upgrade' && appliedImr > 0) return NextResponse.json({error:'IMR credits cannot be combined with an upgrade adjustment.'},{status:400});
    const amount = blueTeamsCheckoutAmount(tier, 'USD', session.metadata, appliedImr);
    const siteUrl = paymentSiteOrigin(request.url);
    const safeReturnUrl = safeInternalUrl(body.returnUrl, siteUrl, '/teams');
    safeReturnUrl.searchParams.set('test_mode', testMode ? '1' : '0');
    safeReturnUrl.searchParams.set('live_test', liveTestMode ? '1' : '0');
    const { data: previous, error: previousError } = await supabaseAdmin.from('payment_orders').select('*').eq('checkout_session_id', session.id).maybeSingle();
    if (previousError) throw new Error('Could not check existing PayPal order.');
    if (previous) {
      const priorMeta = previous.metadata || {};
      if (previous.status !== 'pending' || previous.gateway !== 'paypal') return NextResponse.json({ error: 'This checkout already has a payment attempt. Finish it or start a new checkout.' }, { status: 409 });
      if (previous.user_id !== session.user_id || previous.product_sku !== plan.sku || previous.currency !== 'USD'
        || !moneyEquals(previous.amount, amount) || Number(previous.redeemed_imr) !== appliedImr
        || previous.custom_id !== priorMeta.expected_custom_id
        || priorMeta.expected_invoice_id !== previous.custom_id || priorMeta.expected_order_id !== previous.provider_order_id
        || !moneyEquals(priorMeta.expected_amount, amount) || priorMeta.expected_currency !== 'USD'
        || priorMeta.blue_teams_test_mode !== testMode || Boolean(priorMeta.blue_teams_live_test_mode) !== liveTestMode || !priorMeta.approve_url
        || priorMeta.return_url !== safeReturnUrl.toString()) {
        return NextResponse.json({ error: 'A previous PayPal attempt is still pending. Start a new checkout if it cannot be resumed.' }, { status: 409 });
      }
      const recoveredMetadata = {
        ...session.metadata, product_kind: 'blue_teams', product_sku: plan.sku, payment_provider: 'paypal',
        expected_order_id: previous.provider_order_id, expected_amount: amount, expected_currency: 'USD',
        expected_custom_id: previous.custom_id, expected_invoice_id: previous.custom_id,
        capture_nonce_required: true, txnid: previous.custom_id, return_url: safeReturnUrl.toString(),
        redeemed_imr: appliedImr, imr_discount: appliedImr * 0.5,
        blue_teams_test_mode: testMode, blue_teams_live_test_mode: liveTestMode,
      };
      const { error: recoveryError } = await supabaseAdmin.from('checkout_sessions').update({ metadata: recoveredMetadata }).eq('id', session.id).eq('status', 'pending');
      if (recoveryError) throw new Error('Could not resume the saved PayPal order.');
      return NextResponse.json({ approveUrl: priorMeta.approve_url, orderId: previous.provider_order_id, txnid: previous.custom_id });
    }

    const txnid = `btt_${randomBytes(12).toString('hex')}`;
    const callbackUrl = new URL('/api/teams/checkout/paypal/capture', siteUrl);
    callbackUrl.searchParams.set('session_id', session.id);
    callbackUrl.searchParams.set('txnid', txnid);
    const order = await createPaypalOrder({
      amount, currency: 'USD', description: `Blue Teams ${plan.name} - ${quote?.mode === 'upgrade' ? 'remaining-period upgrade' : '30 days'}`,
      returnUrl: callbackUrl.toString(), cancelUrl: safeReturnUrl.toString(), customId: txnid, invoiceId: txnid,
    });
    const { error: orderError } = await supabaseAdmin.from('payment_orders').insert({
      checkout_session_id: session.id, user_id: session.user_id, product_sku: plan.sku,
      amount, currency: 'USD', redeemed_imr: appliedImr, gateway: 'paypal',
      provider_order_id: order.orderId, custom_id: txnid, status: 'pending', expires_at: session.expires_at,
      metadata: { expected_custom_id: txnid, expected_invoice_id: txnid, billing_cycle: 'monthly',
        expected_order_id: order.orderId, expected_amount: amount, expected_currency: 'USD',
        redeemed_imr: appliedImr, imr_discount: appliedImr * 0.5,
        duration_days: plan.days, approve_url: order.approveUrl, return_url: safeReturnUrl.toString(), blue_teams_test_mode: testMode, blue_teams_live_test_mode: liveTestMode },
      updated_at: new Date().toISOString(),
    });
    if (orderError) throw new Error('Could not save PayPal payment order. Please restart checkout.');
    const updatedMetadata = {
      ...session.metadata, product_kind: 'blue_teams', product_sku: plan.sku,
      payment_provider: 'paypal', expected_order_id: order.orderId, expected_amount: amount,
      expected_currency: 'USD', expected_custom_id: txnid, expected_invoice_id: txnid,
      capture_nonce_required: true, txnid, return_url: safeReturnUrl.toString(),
      redeemed_imr: appliedImr, imr_discount: appliedImr * 0.5,
      blue_teams_test_mode: testMode, blue_teams_live_test_mode: liveTestMode,
    };
    const { error: updateError } = await supabaseAdmin.from('checkout_sessions').update({ metadata: updatedMetadata }).eq('id', session.id).eq('status', 'pending');
    if (updateError) throw new Error('Could not bind PayPal order to checkout.');
    return NextResponse.json({ approveUrl: order.approveUrl, orderId: order.orderId, txnid });
  } catch (error) {
    console.error('[Blue Teams] PayPal order creation failed:', error);
    return NextResponse.json({ error: 'Could not initialize PayPal checkout. Please try again.' }, { status: 500 });
  }
}
