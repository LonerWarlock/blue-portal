import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createPaypalOrder } from '@/lib/paypal';
import { randomBytes } from 'crypto';
import { moneyEquals, safeInternalUrl } from '@/lib/paymentSecurity';
import { getBearerToken } from '@/lib/bluePayg';
import { checkRateLimit, rateLimitHeaders, requestIp } from '@/lib/trafficControl';
import { bluePlanPriceInr, bluePlanPriceUsd, getBlueSubscriptionPlan, isBlueBillingCycle } from '@/lib/blueSubscriptionPlans';
import { paymentSiteOrigin } from '@/lib/paymentOrigin';

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

    // Only IMR redemption needs a rewards wallet. Full-price payments also
    // work for new accounts that do not have a wallet row yet.
    if (appliedImr > 0) {
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from('wallets').select('balance').eq('user_id', session.user_id).maybeSingle();
      const balance = wallet ? Number(wallet.balance) : 0;
      if (walletError || !Number.isFinite(balance) || balance < 0) {
        return NextResponse.json({ error: 'Could not verify your IMR discount. Try again or continue without redeeming IMR.' }, { status: 500 });
      }
      if (appliedImr > balance) {
        return NextResponse.json({ error: 'Insufficient IMR balance' }, { status: 400 });
      }
    }

    // The selected cycle and its amount come exclusively from the stored session/catalogue.
    const amount = bluePlanPriceUsd(session.billing_cycle, appliedImr);
    const amountInr = bluePlanPriceInr(session.billing_cycle, appliedImr);
    const existingMetadata = session.metadata || {};
    const siteUrl = paymentSiteOrigin(request.url);
    const safeReturnUrl = safeInternalUrl(returnUrl, siteUrl, '/console').toString();
    const { data: previousOrder, error: previousOrderError } = await supabaseAdmin
      .from('payment_orders').select('*').eq('checkout_session_id', session.id).maybeSingle();
    if (previousOrderError) throw new Error('Could not read payment order');
    const previousMetadata = previousOrder?.metadata || {};
    if (previousOrder && (previousOrder.status !== 'pending'
      || previousOrder.gateway !== 'paypal' || previousOrder.user_id !== session.user_id
      || previousOrder.product_sku !== plan.sku || previousOrder.currency !== 'USD'
      || !moneyEquals(previousOrder.amount, amount) || Number(previousOrder.redeemed_imr) !== appliedImr
      || !Number.isFinite(new Date(previousOrder.expires_at).getTime())
      || new Date(previousOrder.expires_at).getTime() <= Date.now()
      || !previousOrder.custom_id || previousMetadata.expected_custom_id !== previousOrder.custom_id
      || previousMetadata.expected_invoice_id !== previousOrder.custom_id
      || previousMetadata.return_url !== safeReturnUrl
      || (existingMetadata.payment_provider && existingMetadata.payment_provider !== 'paypal')
      || (existingMetadata.expected_order_id && existingMetadata.expected_order_id !== previousOrder.provider_order_id)
      || (existingMetadata.expected_custom_id && existingMetadata.expected_custom_id !== previousOrder.custom_id))) {
      return NextResponse.json({ error: 'This checkout already has a different or finished payment attempt. Start a new checkout instead.' }, { status: 409 });
    }
    if (!previousOrder && existingMetadata.payment_provider) {
      return NextResponse.json({ error: 'This checkout already has a payment binding. Start a new checkout instead.' }, { status: 409 });
    }
    // Reserve before contacting PayPal. Its immutable invoice ID is also the
    // provider idempotency key, so a network retry cannot create a new charge.
    const txnid = previousOrder?.custom_id || `ppc_${randomBytes(12).toString('hex')}`;
    const orderMetadata = {
      expected_custom_id: txnid, expected_invoice_id: txnid, billing_cycle: session.billing_cycle,
      duration_days: plan.days, return_url: safeReturnUrl,
    };
    if (!previousOrder) {
      const { error: reserveError } = await supabaseAdmin.from('payment_orders').insert({
        checkout_session_id: session.id, user_id: session.user_id, product_sku: plan.sku,
        amount, currency: 'USD', redeemed_imr: appliedImr, gateway: 'paypal',
        provider_order_id: null, custom_id: txnid, status: 'pending', expires_at: session.expires_at,
        metadata: orderMetadata, updated_at: new Date().toISOString(),
      }).select('id').single();
      if (reserveError) {
        return NextResponse.json({ error: 'A payment attempt already exists or could not be reserved. Reload this checkout to continue safely.' }, { status: 409 });
      }
    }
    const paypalReturnUrl = new URL('/api/checkout/paypal/capture', siteUrl);
    paypalReturnUrl.searchParams.set('session_id', session.id);
    paypalReturnUrl.searchParams.set('txnid', txnid);
    let order = previousOrder?.provider_order_id && previousMetadata.approve_url
      ? { orderId: previousOrder.provider_order_id, approveUrl: previousMetadata.approve_url }
      : null;
    if (!order) {
      // A bound row without its approval URL cannot safely be recreated.
      if (previousOrder?.provider_order_id) {
        return NextResponse.json({ error: 'This payment attempt needs confirmation. Start a new checkout only after checking its payment status.' }, { status: 409 });
      }
      order = await createPaypalOrder({
        amount, currency: 'USD',
        description: `Blue Subscription - ${plan.label} Plan (${plan.days} days)`,
        returnUrl: paypalReturnUrl.toString(), cancelUrl: safeReturnUrl,
        customId: txnid, invoiceId: txnid,
      });
      const { error: bindError } = await supabaseAdmin.from('payment_orders').update({
        provider_order_id: order.orderId, metadata: { ...orderMetadata, approve_url: order.approveUrl },
        updated_at: new Date().toISOString(),
      }).eq('checkout_session_id', session.id).eq('status', 'pending').eq('custom_id', txnid)
        .is('provider_order_id', null).select('id').single();
      if (bindError) {
        // Another identical request may have bound the same idempotent order.
        // Never overwrite a different provider ID or a completed ledger row.
        const { data: bound, error: boundError } = await supabaseAdmin.from('payment_orders')
          .select('*').eq('checkout_session_id', session.id).maybeSingle();
        if (boundError || bound?.status !== 'pending' || bound.custom_id !== txnid
          || bound.provider_order_id !== order.orderId || bound.metadata?.approve_url !== order.approveUrl) {
          return NextResponse.json({ error: 'This payment attempt changed while being prepared. Reload to check its status.' }, { status: 409 });
        }
      }
    }
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

    return NextResponse.json({ approveUrl: order.approveUrl, orderId: order.orderId, txnid });
  } catch (error) {
    console.error('[Subscription] PayPal create order failed:', error);
    return NextResponse.json({ error: 'Could not initialize PayPal checkout. Please try again.' }, { status: 500 });
  }
}
