import { NextResponse } from 'next/server';
import {
  matchesExpectedPayuPayment,
  parsePayuForm,
  safeInternalUrl,
  validPayuCallbackSignature,
} from '@/lib/paymentSecurity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const defaultReturnUrl = new URL('/console', siteUrl);
  try {
    const data = parsePayuForm(await request.formData());
    const merchantKey = process.env.PAYU_MERCHANT_KEY?.trim() || '';
    const salt = process.env.PAYU_MERCHANT_SALT?.trim() || '';
    if (
      !merchantKey
      || data.key !== merchantKey
      || !validPayuCallbackSignature(data, salt)
    ) {
      console.error('[Subscription] Rejected PayU callback with invalid signature or merchant key', { txnid: data.txnid });
      defaultReturnUrl.searchParams.set('payment', 'invalid');
      return NextResponse.redirect(defaultReturnUrl, 303);
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }

    const { data: sessions, error } = await supabaseAdmin
      .from('checkout_sessions')
      .select('*')
      .eq('metadata->>txnid', data.txnid)
      .limit(1);
    const session = sessions?.[0];
    if (error || !session) {
      console.error('[Subscription] PayU checkout session not found:', data.txnid, error);
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 });
    }

    const metadata = (session.metadata || {}) as Record<string, unknown>;
    const returnUrl = safeInternalUrl(metadata.return_url, siteUrl, '/console');
    const expected = {
      key: String(metadata.expected_key || ''),
      amount: String(metadata.expected_amount || ''),
      productinfo: String(metadata.expected_productinfo || ''),
      firstname: String(metadata.expected_firstname || ''),
      email: String(metadata.expected_email || ''),
      txnid: String(metadata.txnid || ''),
    };
    if (
      metadata.payment_provider !== 'payu'
      || session.plan !== 'blue'
      || session.billing_cycle !== 'monthly'
      || !matchesExpectedPayuPayment(data, expected)
    ) {
      console.error('[Subscription] Rejected PayU callback that did not match its stored order', { txnid: data.txnid });
      returnUrl.searchParams.set('payment', 'invalid');
      return NextResponse.redirect(returnUrl, 303);
    }

    if (data.status !== 'success') {
      await supabaseAdmin
        .from('checkout_sessions')
        .update({ status: 'expired' })
        .eq('id', session.id)
        .eq('status', 'pending');
      returnUrl.searchParams.set('payment', 'failed');
      return NextResponse.redirect(returnUrl, 303);
    }

    const { error: completionError } = await supabaseAdmin.rpc('complete_blue_subscription_checkout', {
      session_id_param: session.id,
      provider_param: 'payu',
      provider_order_id_param: data.txnid,
      provider_transaction_id_param: data.mihpayid || data.payuMoneyId || data.txnid,
      payer_email_param: data.email,
    });
    if (completionError) {
      throw new Error(`Could not activate subscription: ${completionError.message}`);
    }

    returnUrl.searchParams.set('payment', 'success');
    return NextResponse.redirect(returnUrl, 303);
  } catch (error) {
    console.error('[Subscription] PayU callback failed:', error);
    defaultReturnUrl.searchParams.set('payment', 'failed');
    return NextResponse.redirect(defaultReturnUrl, 303);
  }
}
