import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createPaypalOrder } from '@/lib/paypal';
import { APPROX_USD_TO_INR } from '@/lib/exchangeRate';

const SUBSCRIPTION_PRICE_USD = '1.99';

export async function POST(request: Request) {
  try {
    const { sessionId, returnUrl, redeemedImr } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database admin client not configured' }, { status: 500 });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 });
    }

    const appliedImr = Number(redeemedImr || 0);
    const discount = appliedImr * 0.5;
    const basePriceINR = 149;
    const finalPriceINR = Math.max(1, basePriceINR - discount);

    const discountUsd = discount / APPROX_USD_TO_INR;
    const finalPriceUsd = Math.max(0.01, parseFloat(SUBSCRIPTION_PRICE_USD) - discountUsd);
    const finalPriceUsdStr = finalPriceUsd.toFixed(2);

    const existingMetadata = session.metadata || {};

    let email = existingMetadata.email || '';
    if (!email) {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(session.user_id);
        email = user?.email || '';
      } catch { /* fallback */ }
    }

    const txnid = 'ppc_' + Math.random().toString(36).substring(2, 11) + Date.now().toString().slice(-7);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';
    const paypalReturnUrl = `${siteUrl}/api/checkout/paypal/capture?session_id=${sessionId}&txnid=${txnid}`;
    const paypalCancelUrl = returnUrl || `${siteUrl}/console`;

    const order = await createPaypalOrder({
      amount: finalPriceUsdStr,
      currency: 'USD',
      description: 'Blue Subscription - Monthly Plan',
      returnUrl: paypalReturnUrl,
      cancelUrl: paypalCancelUrl,
      customId: txnid,
      invoiceId: txnid,
    });

    const updatedMetadata = {
      ...existingMetadata,
      paypal_order_id: order.orderId,
      txnid,
      return_url: returnUrl || '',
      redeemed_imr: appliedImr,
      imr_discount: discount,
      price_inr: finalPriceINR,
      price_usd: finalPriceUsdStr,
      currency: 'USD',
      payment_provider: 'paypal',
    };

    await supabaseAdmin
      .from('checkout_sessions')
      .update({ metadata: updatedMetadata })
      .eq('id', sessionId);

    return NextResponse.json({
      approveUrl: order.approveUrl,
      orderId: order.orderId,
    });

  } catch (err: any) {
    console.error('PayPal Create Order Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
