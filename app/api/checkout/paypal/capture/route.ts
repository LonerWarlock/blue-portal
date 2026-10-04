import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { capturePaypalOrder, getPaypalOrder, type PayPalCaptureResult } from '@/lib/paypal';
import { moneyEquals, safeInternalUrl } from '@/lib/paymentSecurity';
import { bluePlanPriceUsd, getBlueSubscriptionPlan, isBlueBillingCycle } from '@/lib/blueSubscriptionPlans';
import { checkRateLimit, requestIp } from '@/lib/trafficControl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id') || '';
  const orderId = searchParams.get('token') || '';
  const txnid = searchParams.get('txnid') || '';
  let returnUrl = new URL('/console', siteUrl);
  let bindingVerified = false;
  try {
    if (!sessionId || !/^[a-zA-Z0-9_-]{1,100}$/.test(orderId) || !supabaseAdmin) {
      return paymentRedirect(returnUrl, 'failed');
    }
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkout_sessions').select('*').eq('id', sessionId).single();
    if (sessionError || !session) return paymentRedirect(returnUrl, 'failed');
    returnUrl = safeInternalUrl(session.metadata?.return_url, siteUrl, '/console');

    const { data: paymentOrder, error: paymentOrderError } = await supabaseAdmin
      .from('payment_orders').select('*').eq('checkout_session_id', session.id).eq('gateway', 'paypal').single();
    if (paymentOrderError || !paymentOrder || !validPaymentBinding(session, paymentOrder, orderId, txnid)) {
      return paymentRedirect(returnUrl, 'invalid');
    }
    bindingVerified = true;
    // Validate the callback binding before acknowledging a completed replay.
    if (session.status === 'completed' && paymentOrder.status === 'completed') {
      return paymentRedirect(returnUrl, 'success');
    }
    if (session.status !== 'pending' || paymentOrder.status !== 'pending') {
      return paymentRedirect(returnUrl, 'failed');
    }
    const sessionExpiry = new Date(session.expires_at).getTime();
    const orderExpiry = new Date(paymentOrder.expires_at).getTime();
    if (!Number.isFinite(sessionExpiry) || !Number.isFinite(orderExpiry)) {
      return paymentRedirect(returnUrl, 'failed');
    }

    const limits = await Promise.all([
      checkRateLimit('payment:paypal:capture:user', session.user_id, { limit: 20, windowSeconds: 10 * 60 }),
      checkRateLimit('payment:paypal:capture:ip', requestIp(request), { limit: 40, windowSeconds: 10 * 60 }),
    ]);
    if (limits.some(result => !result.allowed)) return paymentRedirect(returnUrl, 'failed');

    let capture: PayPalCaptureResult;
    if (sessionExpiry <= Date.now() || orderExpiry <= Date.now()) {
      // A late retry may settle money already collected, but cannot start another charge.
      capture = await getPaypalOrder(orderId);
    } else {
      try {
        capture = await capturePaypalOrder(orderId);
      } catch {
        // The provider can capture successfully while our response/DB commit fails.
        capture = await getPaypalOrder(orderId);
      }
    }
    if (!validCapture(capture, session, paymentOrder, orderId)) {
      console.error('[Subscription] PayPal capture did not match stored payment order', { sessionId, orderId });
      return paymentRedirect(returnUrl, 'invalid');
    }
    const { error: completionError } = await supabaseAdmin.rpc('complete_blue_subscription_checkout', {
      session_id_param: session.id,
      provider_param: 'paypal',
      provider_order_id_param: orderId,
      provider_transaction_id_param: capture.captureId,
      payer_email_param: capture.payerEmail || String(session.metadata?.email || ''),
    });
    if (completionError) throw new Error(`Could not activate subscription: ${completionError.message}`);
    return paymentRedirect(returnUrl, 'success');
  } catch (error) {
    // A concurrent retry can commit the same verified order while this attempt fails.
    if (bindingVerified && supabaseAdmin) {
      try {
        const { data: session } = await supabaseAdmin
          .from('checkout_sessions').select('*').eq('id', sessionId).maybeSingle();
        const { data: paymentOrder } = await supabaseAdmin
          .from('payment_orders').select('*').eq('checkout_session_id', sessionId).eq('gateway', 'paypal').maybeSingle();
        if (session?.status === 'completed' && paymentOrder?.status === 'completed'
          && validPaymentBinding(session, paymentOrder, orderId, txnid)) {
          return paymentRedirect(safeInternalUrl(session.metadata?.return_url, siteUrl, '/console'), 'success');
        }
      } catch {
        // Retain pending records so another verified callback can retry settlement.
      }
    }
    console.error('[Subscription] PayPal capture failed:', error);
    return paymentRedirect(returnUrl, 'failed');
  }
}

function validPaymentBinding(
  session: Record<string, any>, paymentOrder: Record<string, any>, orderId: string, txnid: string
): boolean {
  const plan = getBlueSubscriptionPlan(session.billing_cycle);
  if (session.plan !== 'blue' || !plan || !isBlueBillingCycle(session.billing_cycle)) return false;
  const metadata = session.metadata || {};
  const orderMetadata = paymentOrder.metadata || {};
  const redeemedImr = Number(paymentOrder.redeemed_imr);
  if (!Number.isFinite(redeemedImr) || redeemedImr < 0 || redeemedImr > 100) return false;
  const expectedCustomId = metadata.expected_custom_id;
  const expectedInvoiceId = metadata.expected_invoice_id;
  return paymentOrder.checkout_session_id === session.id
    && paymentOrder.user_id === session.user_id
    && paymentOrder.gateway === 'paypal'
    && paymentOrder.product_sku === plan.sku
    && paymentOrder.currency === 'USD'
    && metadata.payment_provider === 'paypal'
    && metadata.expected_currency === 'USD'
    && moneyEquals(paymentOrder.amount, bluePlanPriceUsd(session.billing_cycle, redeemedImr))
    && moneyEquals(metadata.expected_amount, paymentOrder.amount)
    && Number(metadata.redeemed_imr) === redeemedImr
    && paymentOrder.provider_order_id === orderId
    && metadata.expected_order_id === orderId
    && typeof expectedCustomId === 'string' && expectedCustomId.length > 0
    && typeof expectedInvoiceId === 'string' && expectedInvoiceId.length > 0
    && paymentOrder.custom_id === expectedCustomId
    && metadata.txnid === expectedCustomId
    && orderMetadata.expected_custom_id === expectedCustomId
    && orderMetadata.expected_invoice_id === expectedInvoiceId
    // Existing monthly SDK callbacks had no nonce; new orders always require it.
    && (txnid ? txnid === expectedCustomId : metadata.capture_nonce_required !== true);
}

function validCapture(
  capture: PayPalCaptureResult, session: Record<string, any>, paymentOrder: Record<string, any>, orderId: string
): boolean {
  return capture.status === 'COMPLETED'
    && capture.captureStatus === 'COMPLETED'
    && capture.purchaseUnitCount === 1 && capture.captureCount === 1
    && typeof capture.captureId === 'string' && capture.captureId.length > 0
    && capture.orderId === orderId
    && capture.customId === session.metadata.expected_custom_id
    && capture.invoiceId === session.metadata.expected_invoice_id
    && capture.currency === paymentOrder.currency
    && moneyEquals(capture.grossAmount, paymentOrder.amount);
}

function paymentRedirect(url: URL, status: 'success' | 'failed' | 'invalid') {
  url.searchParams.set('payment', status);
  return NextResponse.redirect(url, 303);
}
