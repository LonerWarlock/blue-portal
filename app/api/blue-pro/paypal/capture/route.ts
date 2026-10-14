import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { capturePaypalOrder, getPaypalOrder, type PayPalCaptureResult } from '@/lib/paypal';
import { moneyEquals, safeInternalUrl } from '@/lib/paymentSecurity';
import { paymentSiteOrigin } from '@/lib/paymentOrigin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const siteUrl = paymentSiteOrigin(request.url);
  let returnUrl = new URL('/blue-pro/dashboard', siteUrl);
  const { searchParams } = new URL(request.url);
  const txnid = searchParams.get('txnid') || '';
  const token = searchParams.get('token') || '';
  let bindingVerified = false;
  try {
    if (!txnid || !/^[a-zA-Z0-9_-]{1,100}$/.test(token) || !supabaseAdmin) {
      return paymentRedirect(returnUrl, 'error');
    }
    const { data: payment, error } = await supabaseAdmin.from('credit_payments')
      .select('*').eq('provider_txnid', txnid).maybeSingle();
    if (error || !payment) return paymentRedirect(returnUrl, 'error');
    const metadata = (payment.metadata || {}) as Record<string, unknown>;
    returnUrl = safeInternalUrl(metadata.return_url, siteUrl, '/blue-pro/dashboard');
    if (payment.payment_provider !== 'paypal' || payment.currency !== 'USD'
      || metadata.paypal_order_id !== token || payment.provider_txnid !== txnid
      || !moneyEquals(metadata.expected_amount, metadata.usd_amount)) {
      return paymentRedirect(returnUrl, 'invalid');
    }
    bindingVerified = true;
    if (payment.status === 'completed') {
      return successRedirect(returnUrl, payment.credits_purchased);
    }
    if (payment.status !== 'pending') return paymentRedirect(returnUrl, 'error');

    let capture: PayPalCaptureResult;
    try { capture = await capturePaypalOrder(token); }
    catch {
      // The provider may already have captured it. Read evidence, not a second charge.
      capture = await getPaypalOrder(token);
    }
    if (capture.status !== 'COMPLETED' || capture.captureStatus !== 'COMPLETED') {
      return paymentRedirect(returnUrl, 'pending');
    }
    if (capture.orderId !== token || !capture.captureId
      || capture.purchaseUnitCount !== 1 || capture.captureCount !== 1
      || capture.currency !== 'USD' || !moneyEquals(capture.grossAmount, metadata.expected_amount)
      || capture.customId !== (metadata.expected_custom_id || txnid)
      || capture.invoiceId !== (metadata.expected_invoice_id || txnid)) {
      return paymentRedirect(returnUrl, 'invalid');
    }

    const { data: completion, error: completionError } = await supabaseAdmin.rpc('complete_blue_credit_payment', {
      payment_id_param: payment.id, provider_txnid_param: txnid,
    });
    if (completionError) throw new Error('Could not activate Blue Credits');
    return successRedirect(returnUrl, completion?.credits || payment.credits_purchased);
  } catch (error) {
    console.error('[Blue PAYG] PayPal confirmation/settlement failed');
    // Keep the pending payment for an idempotent retry. Never label a captured
    // transaction failed solely because credit activation or the network failed.
    return paymentRedirect(returnUrl, bindingVerified ? 'pending' : 'error');
  }
}

function paymentRedirect(url: URL, status: string) {
  url.searchParams.set('payment', status);
  return NextResponse.redirect(url, 303);
}

function successRedirect(url: URL, credits: unknown) {
  url.searchParams.set('credits', String(credits));
  return paymentRedirect(url, 'success');
}
