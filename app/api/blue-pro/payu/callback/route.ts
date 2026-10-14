import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validPayuCallbackSignature, matchesExpectedPayuPayment } from '@/lib/paymentSecurity';
import { paymentSiteOrigin } from '@/lib/paymentOrigin';

export async function POST(request: Request) {
  const site = paymentSiteOrigin(request.url);
  let verifiedPaid = false;
  let resultUrl = new URL('/blue-pro/dashboard', site);
  try {
    const form = await request.formData();
    const data = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
    const key = process.env.PAYU_MERCHANT_KEY?.trim() || '';
    if (!key || data.key !== key || !validPayuCallbackSignature(data, process.env.PAYU_MERCHANT_SALT?.trim() || '')) {
      console.error('[Blue PAYG] Rejected PayU callback with an invalid signature');
      return NextResponse.redirect(new URL('/blue-pro/dashboard?payment=invalid', site), 303);
    }
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database is not configured' }, { status: 500 });

    const { data: payment, error } = await supabaseAdmin
      .from('credit_payments')
      .select('*')
      .eq('provider_txnid', data.txnid)
      .maybeSingle();
    if (error || !payment) return NextResponse.redirect(new URL('/blue-pro/dashboard?payment=error', site), 303);

    const metadata = payment.metadata as Record<string, unknown> | null;
    const returnUrl = safeReturnUrl(String(metadata?.return_url || ''), site);
    resultUrl = returnUrl;
    if (payment.payment_provider !== 'payu' || payment.currency !== 'INR' || !matchesStoredPayment(data, metadata || {})) {
      console.error('[Blue PAYG] Rejected PayU callback whose fields did not match the stored payment');
      return NextResponse.redirect(withQuery(returnUrl, 'payment', 'invalid'), 303);
    }

    if (data.status.trim().toLowerCase() === 'success') {
      verifiedPaid = true;
      const { data: completion, error: completionError } = await supabaseAdmin.rpc('complete_blue_credit_payment', {
        payment_id_param: payment.id,
        provider_txnid_param: data.txnid
      });
      if (completionError) throw new Error(`Could not activate Blue Credits: ${completionError.message}`);
      const redirect = withQuery(returnUrl, 'payment', 'success');
      redirect.searchParams.set('credits', String(completion?.credits || payment.credits_purchased));
      return NextResponse.redirect(redirect, 303);
    }

    await supabaseAdmin
      .from('credit_payments')
      .update({ status: 'failed' })
      .eq('id', payment.id)
      .eq('status', 'pending');
    return NextResponse.redirect(withQuery(returnUrl, 'payment', 'failed'), 303);
  } catch (error) {
    console.error('[Blue PAYG] PayU callback failed:', error);
    return NextResponse.redirect(withQuery(resultUrl, 'payment', verifiedPaid ? 'pending' : 'error'), 303);
  }
}

function matchesStoredPayment(data: Record<string, string>, metadata: Record<string, unknown>): boolean {
  return matchesExpectedPayuPayment(data, {
    key: String(metadata.expected_key || ''), amount: String(metadata.expected_amount || ''),
    productinfo: String(metadata.expected_productinfo || ''), firstname: String(metadata.expected_firstname || ''),
    email: String(metadata.expected_email || ''),
  });
}

function safeReturnUrl(value: string, site: string): URL {
  try {
    const candidate = new URL(value || '/blue-pro/dashboard', site);
    if (candidate.origin === new URL(site).origin) return candidate;
  } catch {
  }
  return new URL('/blue-pro/dashboard', site);
}

function withQuery(url: URL, key: string, value: string): URL {
  const copy = new URL(url);
  copy.searchParams.set(key, value);
  return copy;
}
