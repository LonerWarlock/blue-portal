import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createPaypalOrder } from '@/lib/paypal';
import { randomBytes } from 'crypto';
import { moneyEquals, safeInternalUrl } from '@/lib/paymentSecurity';
import { getBearerToken } from '@/lib/bluePayg';
import { checkRateLimit, rateLimitHeaders, requestIp } from '@/lib/trafficControl';
import { bluePlanPriceInr, bluePlanPriceUsd, getBlueSubscriptionPlan, isBlueBillingCycle } from '@/lib/blueSubscriptionPlans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (String(process.env.DISABLE_CHECKOUT || '').toLowerCase() === 'true') {
      return NextResponse.json({ error: 'Checkout is temporarily paused.' }, { status: 503 });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body.sessionId !== 'string' || !body.sessionId.trim()) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }
    const { sessionId, returnUrl, redeemedImr } = body;
    const appliedImr = Number(redeemedImr ?? 0);
    if (!Number.isFinite(appliedImr) || appliedImr < 0 || appliedImr > 100) {
      return NextResponse.json({ error: 'Invalid IMR amount' }, { status: 400 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database admin client not configured' }, { status: 500 });
    }
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limits = await Promise.all([
      checkRateLimit('payment:paypal:user', authData.user.id, { limit: 10, windowSeconds: 10 * 60 }),
      checkRateLimit('payment:paypal:ip', requestIp(request), { limit: 20, windowSeconds: 10 * 60 }),
    ]);
    const blocked = limits.find(result => !result.allowed);
    if (blocked) {
      return NextResponse.json({ error: 'Too many payment attempts. Please wait and try again.' }, {
        status: blocked.configured ? 429 : 503,
        headers: rateLimitHeaders(blocked),
      });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkout_sessions').select('*').eq('id', sessionId).single();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 });
    }
    if (session.user_id !== authData.user.id) {
      return NextResponse.json({ error: 'Checkout session does not belong to this user' }, { status: 403 });
    }
    const plan = getBlueSubscriptionPlan(session.billing_cycle);
    if (session.plan !== 'blue' || !plan || !isBlueBillingCycle(session.billing_cycle)) {
      return NextResponse.json({ error: 'Unsupported checkout session' }, { status: 400 });
    }
    const expiresAt = new Date(session.expires_at).getTime();
    if (session.status !== 'pending' || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return NextResponse.json({ error: 'Checkout session is no longer active' }, { status: 409 });
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets').select('balance').eq('user_id', session.user_id).single();
    const balance = Number(wallet?.balance);
    if (walletError || !wallet || !Number.isFinite(balance)) {
      return NextResponse.json({ error: 'Could not fetch wallet balance' }, { status: 500 });
    }
    if (appliedImr > balance) {
      return NextResponse.json({ error: 'Insufficient IMR balance' }, { status: 400 });
    }

    // The selected cycle and its amount come exclusively from the stored session/catalogue.
    const amount = bluePlanPriceUsd(session.billing_cycle, appliedImr);
    const amountInr = bluePlanPriceInr(session.billing_cycle, appliedImr);
    const existingMetadata = session.metadata || {};
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const safeReturnUrl = safeInternalUrl(returnUrl, siteUrl, '/console').toString();
    const { data: previousOrder, error: previousOrderError } = await supabaseAdmin
      .from('payment_orders').select('*').eq('checkout_session_id', session.id).maybeSingle();
    if (previousOrderError) throw new Error('Could not read payment order');
    if (previousOrder && previousOrder.status !== 'pending') {
      return NextResponse.json({ error: 'Checkout session is no longer active' }, { status: 409 });
    }
    // Reuse the same pending order on a retry with identical checkout settings.
    const previousMetadata = previousOrder?.metadata || {};
    if (previousOrder?.gateway === 'paypal' && previousOrder.user_id === session.user_id
      && previousOrder.product_sku === plan.sku && previousOrder.currency === 'USD'
      && moneyEquals(previousOrder.amount, amount) && Number(previousOrder.redeemed_imr) === appliedImr
      && previousOrder.provider_order_id === existingMetadata.expected_order_id
      && previousOrder.custom_id === existingMetadata.expected_custom_id
      && previousMetadata.approve_url && previousMetadata.return_url === safeReturnUrl) {
      return NextResponse.json({
        approveUrl: previousMetadata.approve_url,
        orderId: previousOrder.provider_order_id,
        txnid: previousOrder.custom_id,
      });
    }

    const txnid = `ppc_${randomBytes(12).toString('hex')}`;
    const paypalReturnUrl = new URL('/api/checkout/paypal/capture', siteUrl);
    paypalReturnUrl.searchParams.set('session_id', session.id);
    paypalReturnUrl.searchParams.set('txnid', txnid);
    const order = await createPaypalOrder({
      amount, currency: 'USD',
      description: `Blue Subscription - ${plan.label} Plan (${plan.days} days)`,
      returnUrl: paypalReturnUrl.toString(), cancelUrl: safeReturnUrl,
      customId: txnid, invoiceId: txnid,
    });
    const email = authData.user.email || existingMetadata.email || '';
    const updatedMetadata = {
      ...existingMetadata, email, paypal_order_id: order.orderId, txnid,
      return_url: safeReturnUrl, redeemed_imr: appliedImr, imr_discount: appliedImr * 0.5,
      price_inr: amountInr, price_usd: amount, currency: 'USD', payment_provider: 'paypal',
      expected_order_id: order.orderId, expected_amount: amount, expected_currency: 'USD',
      expected_custom_id: txnid, expected_invoice_id: txnid,
      product_sku: plan.sku, duration_days: plan.days, capture_nonce_required: true,
    };
    const { error: updateError } = await supabaseAdmin
      .from('checkout_sessions').update({ metadata: updatedMetadata })
      .eq('id', sessionId).eq('status', 'pending').select('id').single();
    if (updateError) throw new Error('Failed to bind PayPal order to checkout session');

    const paymentOrder = {
      checkout_session_id: session.id, user_id: session.user_id, product_sku: plan.sku,
      amount, currency: 'USD', redeemed_imr: appliedImr, gateway: 'paypal',
      provider_order_id: order.orderId, custom_id: txnid, status: 'pending',
      expires_at: session.expires_at,
      metadata: {
        expected_custom_id: txnid, expected_invoice_id: txnid, billing_cycle: session.billing_cycle,
        duration_days: plan.days, approve_url: order.approveUrl, return_url: safeReturnUrl,
      },
      updated_at: new Date().toISOString(),
    };
    const persistence = previousOrder
      ? supabaseAdmin.from('payment_orders').update(paymentOrder)
        .eq('checkout_session_id', session.id).eq('status', 'pending')
        .eq('provider_order_id', previousOrder.provider_order_id)
      : supabaseAdmin.from('payment_orders').insert(paymentOrder);
    const { error: paymentOrderError } = await persistence.select('id').single();
    if (paymentOrderError) throw new Error('Failed to persist PayPal payment order');
    return NextResponse.json({ approveUrl: order.approveUrl, orderId: order.orderId, txnid });
  } catch (error) {
    console.error('[Subscription] PayPal create order failed:', error);
    return NextResponse.json({ error: 'Could not initialize PayPal checkout. Please try again.' }, { status: 500 });
  }
}
