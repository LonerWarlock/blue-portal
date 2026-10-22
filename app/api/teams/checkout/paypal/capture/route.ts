import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { capturePaypalOrder, getPaypalOrder, type PayPalCaptureResult } from '@/lib/paypal';
import { checkRateLimit, requestIp } from '@/lib/trafficControl';
import { moneyEquals, safeInternalUrl } from '@/lib/paymentSecurity';
import { paymentSiteOrigin } from '@/lib/paymentOrigin';
import { getBlueTeamsPlan, getBlueTeamsPriceUsd, getBlueTeamsTierFromCheckoutPlan } from '@/lib/blueTeamsPlans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const siteUrl = paymentSiteOrigin(request.url);
  let returnUrl = new URL('/teams', siteUrl);
  let bindingVerified = false;
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = params.get('session_id') || '';
    const orderId = params.get('token') || '';
    const txnid = params.get('txnid') || '';
    if (!sessionId || !/^[a-zA-Z0-9_-]{1,100}$/.test(orderId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(txnid) || !supabaseAdmin) {
      return redirect(returnUrl, 'failed');
    }
    const { data: session, error: sessionError } = await supabaseAdmin.from('checkout_sessions').select('*').eq('id', sessionId).single();
    if (sessionError || !session) return redirect(returnUrl, 'failed');
    returnUrl = safeInternalUrl(session.metadata?.return_url, siteUrl, '/teams');
    const { data: paymentOrder, error: orderError } = await supabaseAdmin.from('payment_orders').select('*').eq('checkout_session_id', session.id).eq('gateway', 'paypal').single();
    if (orderError || !paymentOrder || !validPaymentBinding(session, paymentOrder, orderId, txnid)) return redirect(returnUrl, 'invalid');
    bindingVerified = true;
    returnUrl.searchParams.set('test_mode', session.metadata?.blue_teams_test_mode === true ? '1' : '0');
    returnUrl.searchParams.set('live_test', session.metadata?.blue_teams_live_test_mode === true ? '1' : '0');

    const sessionExpiry = new Date(session.expires_at).getTime();
    const orderExpiry = new Date(paymentOrder.expires_at).getTime();
    if (!Number.isFinite(sessionExpiry) || !Number.isFinite(orderExpiry)) return redirect(returnUrl, 'failed');
    const limits = await Promise.all([
      checkRateLimit('teams:paypal:capture:user', session.user_id, { limit: 20, windowSeconds: 10 * 60 }),
      checkRateLimit('teams:paypal:capture:ip', requestIp(request), { limit: 40, windowSeconds: 10 * 60 }),
    ]);
    if (limits.some(result => !result.allowed)) return redirect(returnUrl, 'failed');

    let capture: PayPalCaptureResult;
    if (sessionExpiry <= Date.now() || orderExpiry <= Date.now()) {
      capture = await getPaypalOrder(orderId);
    } else {
      try { capture = await capturePaypalOrder(orderId); }
      catch { capture = await getPaypalOrder(orderId); }
    }
    if (!validCapture(capture, session, paymentOrder, orderId)) {
      console.error('[Blue Teams] PayPal capture did not match its stored order', { sessionId, orderId });
      return redirect(returnUrl, 'invalid');
    }
    const { error: completionError } = await supabaseAdmin.rpc('complete_blue_teams_checkout', {
      session_id_param: session.id, provider_param: 'paypal', provider_order_id_param: orderId,
      provider_transaction_id_param: capture.captureId!, payer_email_param: capture.payerEmail || String(session.metadata?.email || ''),
    });
    if (completionError) throw new Error(`Could not activate Blue Teams: ${completionError.message}`);
    return redirect(returnUrl, 'success');
  } catch (error) {
    if (bindingVerified && supabaseAdmin) {
      try {
        const sessionId = new URL(request.url).searchParams.get('session_id') || '';
        const { data: session } = await supabaseAdmin.from('checkout_sessions').select('*').eq('id', sessionId).maybeSingle();
        const { data: order } = await supabaseAdmin.from('payment_orders').select('*').eq('checkout_session_id', sessionId).eq('gateway', 'paypal').maybeSingle();
        const params = new URL(request.url).searchParams;
        if (session?.status === 'completed' && order?.status === 'completed'
          && validPaymentBinding(session, order, params.get('token') || '', params.get('txnid') || '')) return redirect(returnUrl, 'success');
      } catch { /* Keep the verified order available for a safe retry. */ }
    }
    console.error('[Blue Teams] PayPal capture failed:', error);
    return redirect(returnUrl, bindingVerified ? 'pending' : 'error');
  }
}

function validPaymentBinding(session: Record<string, any>, order: Record<string, any>, orderId: string, txnid: string): boolean {
  const tier = getBlueTeamsTierFromCheckoutPlan(session.plan);
  const plan = getBlueTeamsPlan(tier);
  const metadata = session.metadata || {};
  const orderMetadata = order.metadata || {};
  const testMode = metadata.blue_teams_test_mode === true;
  const liveTestMode = metadata.blue_teams_live_test_mode === true;
  const testPrice = testMode || liveTestMode;
  const redeemedImr = Number(order.redeemed_imr);
  const amount = tier && Number.isFinite(redeemedImr) && redeemedImr >= 0 && redeemedImr <= 100
    ? getBlueTeamsPriceUsd(tier, testMode, redeemedImr, liveTestMode)
    : null;
  return Boolean(tier && plan && session.billing_cycle === 'monthly' && metadata.product_kind === 'blue_teams'
    && metadata.payment_provider === 'paypal' && metadata.expected_currency === 'USD'
    && order.checkout_session_id === session.id && order.user_id === session.user_id
    && order.gateway === 'paypal' && order.product_sku === plan.sku && order.currency === 'USD'
    && Number.isFinite(redeemedImr) && redeemedImr >= 0 && redeemedImr <= 100
    && !(testMode && liveTestMode) && (!testPrice || redeemedImr === 0) && ['pending', 'completed'].includes(order.status)
    && moneyEquals(order.amount, amount) && moneyEquals(metadata.expected_amount, order.amount)
    && Number(metadata.redeemed_imr) === redeemedImr
    && order.provider_order_id === orderId && metadata.expected_order_id === orderId
    && order.custom_id === txnid && metadata.txnid === txnid && metadata.expected_custom_id === txnid
    && metadata.expected_invoice_id === txnid && orderMetadata.expected_custom_id === txnid
    && orderMetadata.expected_invoice_id === txnid && orderMetadata.expected_order_id === orderId
    && orderMetadata.expected_currency === 'USD' && moneyEquals(orderMetadata.expected_amount, order.amount)
    && orderMetadata.blue_teams_test_mode === testMode
    && Boolean(orderMetadata.blue_teams_live_test_mode) === liveTestMode
    && txnid.length > 0);
}

function validCapture(capture: PayPalCaptureResult, session: Record<string, any>, order: Record<string, any>, orderId: string): boolean {
  return capture.status === 'COMPLETED' && capture.captureStatus === 'COMPLETED'
    && capture.purchaseUnitCount === 1 && capture.captureCount === 1
    && typeof capture.captureId === 'string' && capture.captureId.length > 0
    && capture.orderId === orderId && capture.customId === session.metadata.expected_custom_id
    && capture.invoiceId === session.metadata.expected_invoice_id
    && capture.currency === order.currency && moneyEquals(capture.grossAmount, order.amount);
}

function redirect(url: URL, payment: 'success' | 'failed' | 'invalid' | 'pending' | 'error') {
  url.searchParams.set('payment', payment);
  return NextResponse.redirect(url, 303);
}
