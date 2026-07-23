import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createPaypalOrder } from '@/lib/paypal';
import { getPackConfig, APPROX_USD_TO_INR } from '@/lib/exchangeRate';

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database is not configured' }, { status: 500 });

    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
    if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { returnUrl?: string; packId?: string };
    const pack = getPackConfig(body.packId);

    const { data: account } = await supabaseAdmin.auth.admin.getUserById(data.user.id);
    const email = account.user?.email || '';
    if (!email) return NextResponse.json({ error: 'Your account does not have an email address' }, { status: 400 });

    const txnid = `pp_${Math.random().toString(36).substring(2, 10)}${Date.now().toString().slice(-6)}`;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3005';
    const paypalReturnUrl = `${siteUrl}/api/blue-pro/paypal/capture?txnid=${txnid}`;
    const paypalCancelUrl = body.returnUrl || `${siteUrl}/blue-pro/checkout`;

    const order = await createPaypalOrder({
      amount: pack.priceUSD.toFixed(2),
      currency: 'USD',
      description: `${pack.name} - ${pack.credits} Blue Credits`,
      returnUrl: paypalReturnUrl,
      cancelUrl: paypalCancelUrl,
      customId: txnid,
      invoiceId: txnid,
    });

    const { data: payment, error: insertError } = await supabaseAdmin
      .from('credit_payments')
      .insert({
        user_id: data.user.id,
        amount_paid: pack.priceINR,
        currency: 'USD',
        credits_purchased: pack.credits,
        pack_id: pack.id,
        payment_provider: 'paypal',
        provider_txnid: txnid,
        status: 'pending',
        metadata: {
          paypal_order_id: order.orderId,
          usd_amount: pack.priceUSD,
          exchange_rate: APPROX_USD_TO_INR,
          return_url: paypalCancelUrl,
          expected_amount: pack.priceUSD.toFixed(2),
          expected_productinfo: `${pack.name} - ${pack.credits} Blue Credits`,
          expected_email: email,
        },
      })
      .select('id')
      .single();

    if (insertError) throw new Error('Failed to create the payment record');

    return NextResponse.json({
      approveUrl: order.approveUrl,
      orderId: order.orderId,
      paymentId: payment.id,
    });

  } catch (err: any) {
    console.error('PayPal Blue Pro Create Order Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
