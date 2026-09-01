import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createPaypalOrder } from '@/lib/paypal';
import { APPROX_USD_TO_INR } from '@/lib/exchangeRate';
import { randomBytes } from 'crypto';
import { safeInternalUrl } from '@/lib/paymentSecurity';
import { getBearerToken } from '@/lib/bluePayg';
import { checkRateLimit, rateLimitHeaders, requestIp } from '@/lib/trafficControl';

const SUBSCRIPTION_PRICE_USD = '1.99';

export async function POST(request: Request) {
  try {
    const { sessionId, returnUrl, redeemedImr } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
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
      .from('checkout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 });
    }
    if (session.user_id !== authData.user.id) {
      return NextResponse.json({ error: 'Checkout session does not belong to this user' }, { status: 403 });
    }
    if (session.plan !== 'blue' || session.billing_cycle !== 'monthly') {
      return NextResponse.json({ error: 'Unsupported checkout session' }, { status: 400 });
    }
    if (session.status !== 'pending' || new Date(session.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Checkout session is no longer active' }, { status: 409 });
    }

    const appliedImr = Number(redeemedImr || 0);
    if (!Number.isFinite(appliedImr) || appliedImr < 0 || appliedImr > 100) {
      return NextResponse.json({ error: 'Invalid IMR amount' }, { status: 400 });
    }
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', session.user_id)
      .single();
    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Could not fetch wallet balance' }, { status: 500 });
    }
    if (appliedImr > Number(wallet.balance || 0)) {
      return NextResponse.json({ error: 'Insufficient IMR balance' }, { status: 400 });
    }
    const discount = appliedImr * 0.5;
    const basePriceINR = 149;
    const finalPriceINR = Math.max(1, basePriceINR - discount);

    const discountUsd = discount / APPROX_USD_TO_INR;
    const finalPriceUsd = Math.max(0.01, parseFloat(SUBSCRIPTION_PRICE_USD) - discountUsd);
    const finalPriceUsdStr = finalPriceUsd.toFixed(2);

    const existingMetadata = session.metadata || {};

    let email = existingMetadata.email || '';
    if (!email) {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(session.user_id);
        email = user?.email || '';
      } catch { /* fallback */ }
    }

    const txnid = `ppc_${randomBytes(12).toString('hex')}`;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';
    const paypalReturnUrl = `${siteUrl}/api/checkout/paypal/capture?session_id=${sessionId}&txnid=${txnid}`;
    const safeReturnUrl = safeInternalUrl(returnUrl, siteUrl, '/console').toString();
    const paypalCancelUrl = safeReturnUrl;

    const order = await createPaypalOrder({
      amount: finalPriceUsdStr,
      currency: 'USD',
      description: 'Blue Subscription - Monthly Plan',
      returnUrl: paypalReturnUrl,
      cancelUrl: paypalCancelUrl,
      customId: txnid,
      invoiceId: txnid,
    });

    const updatedMetadata = {
      ...existingMetadata,
      paypal_order_id: order.orderId,
      txnid,
      return_url: safeReturnUrl,
      redeemed_imr: appliedImr,
      imr_discount: discount,
      price_inr: finalPriceINR,
      price_usd: finalPriceUsdStr,
      currency: 'USD',
      payment_provider: 'paypal',
      expected_order_id: order.orderId,
      expected_amount: finalPriceUsdStr,
      expected_currency: 'USD',
      expected_custom_id: txnid,
      expected_invoice_id: txnid,
    };

    const { error: updateError } = await supabaseAdmin
      .from('checkout_sessions')
      .update({ metadata: updatedMetadata })
      .eq('id', sessionId)
      .eq('status', 'pending');
    if (updateError) throw new Error('Failed to bind PayPal order to checkout session');

    const { error: paymentOrderError } = await supabaseAdmin
      .from('payment_orders')
      .upsert({
        checkout_session_id: session.id,
        user_id: session.user_id,
        product_sku: 'blue_monthly',
        amount: finalPriceUsdStr,
        currency: 'USD',
        redeemed_imr: appliedImr,
        gateway: 'paypal',
        provider_order_id: order.orderId,
        custom_id: txnid,
        status: 'pending',
        expires_at: session.expires_at,
        metadata: { expected_custom_id: txnid, expected_invoice_id: txnid },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'checkout_session_id' });
    if (paymentOrderError) throw new Error('Failed to persist PayPal payment order');

    return NextResponse.json({
      approveUrl: order.approveUrl,
      orderId: order.orderId,
    });

  } catch (err: any) {
    console.error('PayPal Create Order Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
