import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { capturePaypalOrder } from '@/lib/paypal';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';
  const dashboardUrl = `${siteUrl}/blue-pro/dashboard`;

  try {
    const { searchParams } = new URL(request.url);
    const txnid = searchParams.get('txnid');
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(`${dashboardUrl}?payment=failed`, 303);
    }

    if (!supabaseAdmin) {
      return NextResponse.redirect(`${dashboardUrl}?payment=failed`, 303);
    }

    let payment = null;

    if (txnid && txnid !== 'pp_placeholder') {
      const { data } = await supabaseAdmin
        .from('credit_payments')
        .select('*')
        .eq('provider_txnid', txnid)
        .maybeSingle();
      payment = data;
    }

    if (!payment) {
      return NextResponse.redirect(`${dashboardUrl}?payment=failed`, 303);
    }

    const metadata = payment.metadata as Record<string, unknown> | null;
    const returnUrl = safeReturnUrl(String(metadata?.return_url || ''), siteUrl);

    if (payment.status === 'completed') {
      const redirect = withQuery(returnUrl, 'payment', 'success');
      redirect.searchParams.set('credits', String(payment.credits_purchased));
      return NextResponse.redirect(redirect, 303);
    }

    const captureResult = await capturePaypalOrder(token);

    if (captureResult.status !== 'COMPLETED') {
      await supabaseAdmin
        .from('credit_payments')
        .update({ status: 'failed' })
        .eq('id', payment.id)
        .eq('status', 'pending');
      return NextResponse.redirect(withQuery(returnUrl, 'payment', 'failed'), 303);
    }

    const { data: completion, error: completionError } = await supabaseAdmin.rpc('complete_blue_credit_payment', {
      payment_id_param: payment.id,
      provider_txnid_param: payment.provider_txnid,
    });

    if (completionError) throw new Error(`Could not activate Blue Credits: ${completionError.message}`);

    const redirect = withQuery(returnUrl, 'payment', 'success');
    redirect.searchParams.set('credits', String(completion?.credits || payment.credits_purchased));
    return NextResponse.redirect(redirect, 303);

  } catch (err: any) {
    if (err?.message?.includes('ORDER_ALREADY_CAPTURED') && supabaseAdmin) {
      try {
        const { searchParams } = new URL(request.url);
        const txnid = searchParams.get('txnid');
        const { data: recheck } = await supabaseAdmin
          .from('credit_payments')
          .select('status, credits_purchased, metadata')
          .eq('provider_txnid', txnid || '')
          .single();
        if (recheck?.status === 'completed') {
          const metadata = recheck.metadata as Record<string, unknown> | null;
          const returnUrl = safeReturnUrl(String(metadata?.return_url || ''), siteUrl);
          const redirect = withQuery(returnUrl, 'payment', 'success');
          redirect.searchParams.set('credits', String(recheck.credits_purchased));
          return NextResponse.redirect(redirect, 303);
        }
      } catch { /* fall through to error redirect */ }
    }
    console.error('[Blue PAYG] PayPal capture failed:', err);
    return NextResponse.redirect(`${dashboardUrl}?payment=error`, 303);
  }
}

function safeReturnUrl(value: string, site: string): URL {
  try {
    const candidate = new URL(value || '/blue-pro/dashboard', site);
    if (candidate.origin === new URL(site).origin) return candidate;
  } catch { /* fallback */ }
  return new URL('/blue-pro/dashboard', site);
}

function withQuery(url: URL, key: string, value: string): URL {
  const copy = new URL(url);
  copy.searchParams.set(key, value);
  return copy;
}
