import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { capturePaypalOrder } from '@/lib/paypal';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const token = searchParams.get('token');

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';
    const consoleUrl = `${siteUrl}/console`;

    if (!sessionId || !token) {
      return NextResponse.redirect(`${consoleUrl}?payment=failed`, 303);
    }

    if (!supabaseAdmin) {
      return NextResponse.redirect(`${consoleUrl}?payment=failed`, 303);
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.redirect(`${consoleUrl}?payment=failed`, 303);
    }

    const metadata = session.metadata || {};
    const returnUrl = metadata.return_url || consoleUrl;

    if (session.status === 'completed') {
      return NextResponse.redirect(`${returnUrl}?payment=success`, 303);
    }

    const captureResult = await capturePaypalOrder(token);

    if (captureResult.status !== 'COMPLETED') {
      await supabaseAdmin
        .from('checkout_sessions')
        .update({ status: 'expired' })
        .eq('id', session.id)
        .eq('status', 'pending');

      return NextResponse.redirect(`${returnUrl}?payment=failed`, 303);
    }

    const { data: claimedSession, error: claimError } = await supabaseAdmin
      .from('checkout_sessions')
      .update({ status: 'completed' })
      .eq('id', session.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (claimError) throw new Error(`Failed to complete checkout: ${claimError.message}`);
    if (!claimedSession) {
      return NextResponse.redirect(`${returnUrl}?payment=success`, 303);
    }

    const txnid = metadata.txnid || ('ppc_' + Math.random().toString(36).substring(2, 11) + Date.now().toString().slice(-7));

    const appliedImr = Number(metadata.redeemed_imr || 0);
    if (appliedImr > 0) {
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('balance')
        .eq('user_id', session.user_id)
        .single();

      if (wallet) {
        const currentBalance = Number(wallet.balance || 0);
        const newBalance = Math.max(0, currentBalance - appliedImr);
        await supabaseAdmin
          .from('wallets')
          .update({ balance: newBalance })
          .eq('user_id', session.user_id);
      }
    }

    const currentPeriodStart = new Date().toISOString();
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: session.user_id,
        plan: 'blue',
        status: 'active',
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        stripe_subscription_id: 'paypal_' + txnid,
        stripe_customer_id: 'paypal_' + (captureResult.payerEmail || metadata.email || ''),
        metadata: {
          email: captureResult.payerEmail || metadata.email || '',
          paypal_order_id: captureResult.orderId,
          paypal_capture_id: captureResult.captureId,
          warning_email_sent: false,
          expiry_email_sent: false,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (subError) {
      console.error('Failed to upsert active subscription row:', subError);
    }

    return NextResponse.redirect(`${returnUrl}?payment=success`, 303);

  } catch (err: any) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';
    if (err?.message?.includes('ORDER_ALREADY_CAPTURED') && supabaseAdmin) {
      try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const { data: recheck } = await supabaseAdmin
          .from('checkout_sessions')
          .select('status, metadata')
          .eq('id', sessionId || '')
          .single();
        if (recheck?.status === 'completed') {
          const meta = recheck.metadata || {};
          const returnUrl = meta.return_url || `${siteUrl}/console`;
          return NextResponse.redirect(`${returnUrl}?payment=success`, 303);
        }
      } catch { /* fall through to error redirect */ }
    }
    console.error('PayPal Capture Error:', err);
    return NextResponse.redirect(`${siteUrl}/console?payment=failed`, 303);
  }
}
