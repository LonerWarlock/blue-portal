import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getBearerToken } from '@/lib/bluePayg';
import { checkRateLimit, rateLimitHeaders, requestIp } from '@/lib/trafficControl';
import { moneyEquals, payuRequestHash, safeInternalUrl } from '@/lib/paymentSecurity';
import { paymentSiteOrigin } from '@/lib/paymentOrigin';
import { BLUE_TEAMS_LIVE_TEST_TIER, getBlueTeamsPlan, getBlueTeamsPriceInr, getBlueTeamsTierFromCheckoutPlan } from '@/lib/blueTeamsPlans';
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
      checkRateLimit('teams:payu:user', auth.user.id, { limit: 8, windowSeconds: 10 * 60 }),
      checkRateLimit('teams:payu:ip', requestIp(request), { limit: 16, windowSeconds: 10 * 60 }),
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
    if (!teamsSessionModeAllowed(testMode, 'payu')) return NextResponse.json({ error: 'PayU is not configured for this checkout mode.' }, { status: 503 });
    if (testPrice && appliedImr > 0) return NextResponse.json({ error: 'IMR credits are not used for this ₹1 launch test.' }, { status: 400 });
    const expiresAt = new Date(session.expires_at).getTime();
    if (session.status !== 'pending' || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return NextResponse.json({ error: 'Checkout session has expired. Please start again.' }, { status: 409 });

    const key = process.env.PAYU_MERCHANT_KEY?.trim() || '';
    const salt = process.env.PAYU_MERCHANT_SALT?.trim() || '';
    if (!key || !salt) return NextResponse.json({ error: 'PayU is not configured.' }, { status: 503 });
    const payuUrl = process.env.NEXT_PUBLIC_PAYU_URL?.trim() || 'https://secure.payu.in/_payment';
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets').select('balance').eq('user_id', session.user_id).single();
    const balance = Number(wallet?.balance);
    if (walletError || !wallet || !Number.isFinite(balance)) return NextResponse.json({ error: 'Could not fetch wallet balance.' }, { status: 500 });
    if (appliedImr > balance) return NextResponse.json({ error: `Insufficient IMR balance. You only have ${balance} IMR available.` }, { status: 400 });
    const amount = getBlueTeamsPriceInr(tier, testMode, appliedImr, liveTestMode);
    let productinfo = `Blue Teams ${plan.name} - 30 days`;
    let email = String(session.metadata?.email || auth.user.email || '').slice(0, 254);
    if (!email) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(session.user_id);
      email = String(data.user?.email || '').slice(0, 254);
    }
    let firstname = (email.split('@')[0] || 'Customer').slice(0, 60);
    const origin = paymentSiteOrigin(request.url);
    const returnUrl = safeInternalUrl(body.returnUrl, origin, '/teams');
    returnUrl.searchParams.set('test_mode', testMode ? '1' : '0');
    returnUrl.searchParams.set('live_test', liveTestMode ? '1' : '0');

    const { data: prior, error: priorError } = await supabaseAdmin.from('payment_orders').select('*').eq('checkout_session_id', session.id).maybeSingle();
    if (priorError) throw new Error('Could not check existing payment order.');
    let txnid: string;
    if (prior) {
      if (prior.status !== 'pending' || prior.gateway !== 'payu') return NextResponse.json({ error: 'This checkout already has a payment attempt. Finish it or start a new checkout.' }, { status: 409 });
      const previousMetadata = prior.metadata || {};
      if (prior.user_id !== session.user_id || prior.product_sku !== plan.sku || prior.currency !== 'INR'
        || !moneyEquals(prior.amount, amount) || Number(prior.redeemed_imr) !== appliedImr
        || previousMetadata.blue_teams_test_mode !== testMode
        || Boolean(previousMetadata.blue_teams_live_test_mode) !== liveTestMode
        || typeof prior.provider_order_id !== 'string' || !prior.provider_order_id.startsWith('bt_')
        || !previousMetadata.productinfo || !previousMetadata.firstname || !previousMetadata.email) {
        return NextResponse.json({ error: 'A previous PayU attempt is still pending. Start a new checkout if it cannot be resumed.' }, { status: 409 });
      }
      txnid = prior.provider_order_id;
      productinfo = String(previousMetadata.productinfo);
      firstname = String(previousMetadata.firstname);
      email = String(previousMetadata.email);
    } else {
      txnid = `bt_${randomBytes(12).toString('hex')}`;
      const { error: orderError } = await supabaseAdmin.from('payment_orders').insert({
        checkout_session_id: session.id, user_id: session.user_id, product_sku: plan.sku,
        amount, currency: 'INR', redeemed_imr: appliedImr, gateway: 'payu', provider_order_id: txnid,
        custom_id: txnid, status: 'pending', expires_at: session.expires_at,
        metadata: { productinfo, firstname, email, billing_cycle: 'monthly', duration_days: plan.days,
          redeemed_imr: appliedImr, imr_discount: appliedImr * 0.5, blue_teams_test_mode: testMode, blue_teams_live_test_mode: liveTestMode },
        updated_at: new Date().toISOString(),
      });
      if (orderError) throw new Error('Could not reserve the PayU payment attempt.');
    }

    const updatedMetadata = {
      ...session.metadata, email, product_kind: 'blue_teams', product_sku: plan.sku,
      txnid, return_url: returnUrl.toString(), payment_provider: 'payu', expected_key: key,
      expected_amount: amount, expected_productinfo: productinfo, expected_firstname: firstname,
      expected_email: email, redeemed_imr: appliedImr, imr_discount: appliedImr * 0.5,
      blue_teams_test_mode: testMode, blue_teams_live_test_mode: liveTestMode,
    };
    const { error: updateError } = await supabaseAdmin.from('checkout_sessions').update({ metadata: updatedMetadata }).eq('id', session.id).eq('status', 'pending');
    if (updateError) throw new Error('Could not bind PayU payment to checkout.');

    const hash = payuRequestHash({ key, txnid, amount, productinfo, firstname, email }, salt);
    return NextResponse.json({ key, txnid, amount, productinfo, firstname, email, hash, payuUrl });
  } catch (error) {
    console.error('[Blue Teams] PayU checkout initialization failed:', error);
    return NextResponse.json({ error: 'Could not initialize PayU checkout. Please try again.' }, { status: 500 });
  }
}
