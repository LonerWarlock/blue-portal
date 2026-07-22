import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3005';
  try {
    const form = await request.formData();
    const data = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
    if (!validSignature(data)) {
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
    if (!matchesStoredPayment(data, metadata || {})) {
      console.error('[Blue PAYG] Rejected PayU callback whose fields did not match the stored payment');
      return NextResponse.redirect(withQuery(returnUrl, 'payment', 'invalid'), 303);
    }

    if (data.status === 'success') {
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
    return NextResponse.redirect(new URL('/blue-pro/dashboard?payment=error', site), 303);
  }
}

function validSignature(data: Record<string, string>): boolean {
  const salt = process.env.PAYU_MERCHANT_SALT || '';
  if (!salt || !data.hash) return false;
  const base = `${salt}|${data.status}|||||||||||${data.email}|${data.firstname}|${data.productinfo}|${data.amount}|${data.txnid}|${data.key}`;
  const input = data.additionalCharges ? `${data.additionalCharges}|${base}` : base;
  const expected = createHash('sha512').update(input).digest();
  const received = Buffer.from(data.hash, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function matchesStoredPayment(data: Record<string, string>, metadata: Record<string, unknown>): boolean {
  return data.key === String(metadata.expected_key || '')
    && data.amount === String(metadata.expected_amount || '')
    && data.productinfo === String(metadata.expected_productinfo || '')
    && data.firstname === String(metadata.expected_firstname || '')
    && data.email === String(metadata.expected_email || '');
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
