import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { capturePaypalOrder } from '@/lib/paypal';
import { moneyEquals, safeInternalUrl } from '@/lib/paymentSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const fallback = new URL('/console', siteUrl);
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id') || '';
    const orderId = searchParams.get('token') || '';
    if (!sessionId || !orderId || !supabaseAdmin) return paymentRedirect(fallback, 'failed');

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (sessionError || !session) return paymentRedirect(fallback, 'failed');

    const metadata = (session.metadata || {}) as Record<string, unknown>;
    const returnUrl = safeInternalUrl(metadata.return_url, siteUrl, '/console');
    if (session.status === 'completed') return paymentRedirect(returnUrl, 'success');
    if (session.status !== 'pending' || new Date(session.expires_at).getTime() <= Date.now()) {
      return paymentRedirect(returnUrl, 'failed');
    }

    const { data: paymentOrder, error: paymentOrderError } = await supabaseAdmin
      .from('payment_orders')
      .select('*')
      .eq('checkout_session_id', session.id)
      .eq('gateway', 'paypal')
      .single();
    if (paymentOrderError || !paymentOrder || paymentOrder.status !== 'pending') {
      return paymentRedirect(returnUrl, 'failed');
    }
    if (paymentOrder.provider_order_id !== orderId || metadata.expected_order_id !== orderId) {
      console.error('[Subscription] PayPal callback order mismatch', { sessionId });
      return paymentRedirect(returnUrl, 'invalid');
    }

    const capture = await capturePaypalOrder(orderId);
    const expectedCustomId = String(metadata.expected_custom_id || '');
    const expectedInvoiceId = String(metadata.expected_invoice_id || '');
    const validCapture = capture.status === 'COMPLETED'
      && capture.orderId === orderId
      && capture.customId === expectedCustomId
      && capture.invoiceId === expectedInvoiceId
      && capture.currency === paymentOrder.currency
      && moneyEquals(capture.grossAmount, paymentOrder.amount);
    if (!validCapture) {
      console.error('[Subscription] PayPal capture did not match stored payment order', { sessionId, orderId });
      return paymentRedirect(returnUrl, 'invalid');
    }

    const { error: completionError } = await supabaseAdmin.rpc('complete_blue_subscription_checkout', {
      session_id_param: session.id,
      provider_param: 'paypal',
      provider_order_id_param: orderId,
      provider_transaction_id_param: capture.captureId || orderId,
      payer_email_param: capture.payerEmail || String(metadata.email || ''),
    });
    if (completionError) throw new Error(`Could not activate subscription: ${completionError.message}`);
    return paymentRedirect(returnUrl, 'success');
  } catch (error) {
    // Repeated provider capture is safe only after our transaction committed.
    if (supabaseAdmin) {
      try {
        const sessionId = new URL(request.url).searchParams.get('session_id') || '';
        const { data: session } = await supabaseAdmin
          .from('checkout_sessions')
          .select('status, metadata')
          .eq('id', sessionId)
          .maybeSingle();
        if (session?.status === 'completed') {
          return paymentRedirect(safeInternalUrl(session.metadata?.return_url, siteUrl, '/console'), 'success');
        }
      } catch {
        // Fall through to the safe failure redirect.
      }
    }
    console.error('[Subscription] PayPal capture failed:', error);
    return paymentRedirect(fallback, 'failed');
  }
}

function paymentRedirect(url: URL, status: 'success' | 'failed' | 'invalid') {
  url.searchParams.set('payment', status);
  return NextResponse.redirect(url, 303);
}
