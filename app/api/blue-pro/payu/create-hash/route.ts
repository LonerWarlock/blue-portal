import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { APPROX_USD_TO_INR, getPackConfig } from '@/lib/exchangeRate';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database is not configured' }, { status: 500 });
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
    if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { returnUrl?: string; packId?: string };
    const pack = getPackConfig(body.packId);
    const amountINR = pack.priceINR;
    const merchantKey = process.env.PAYU_MERCHANT_KEY || '';
    const salt = process.env.PAYU_MERCHANT_SALT || '';
    if (!merchantKey || !salt) return NextResponse.json({ error: 'PayU credentials are not configured' }, { status: 500 });

    const { data: account } = await supabaseAdmin.auth.admin.getUserById(data.user.id);
    const email = account.user?.email || '';
    if (!email) return NextResponse.json({ error: 'Your account does not have an email address' }, { status: 400 });

    const txnid = `bcp_${randomBytes(12).toString('hex')}`;
    const amount = amountINR.toFixed(2);
    const productinfo = `${pack.name} - ${pack.credits} Blue Credits`;
    const firstname = email.split('@')[0] || 'Customer';
    const returnUrl = safeReturnUrl(body.returnUrl);
    const hash = createHash('sha512')
      .update(`${merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`)
      .digest('hex');

    const { data: payment, error: insertError } = await supabaseAdmin
      .from('credit_payments')
      .insert({
        user_id: data.user.id,
        amount_paid: amountINR,
        currency: 'INR',
        credits_purchased: pack.credits,
        pack_id: pack.id,
        payment_provider: 'payu',
        provider_txnid: txnid,
        status: 'pending',
        metadata: {
          usd_amount: pack.priceUSD,
          exchange_rate: APPROX_USD_TO_INR,
          return_url: returnUrl,
          expected_key: merchantKey,
          expected_amount: amount,
          expected_productinfo: productinfo,
          expected_firstname: firstname,
          expected_email: email
        }
      })
      .select('id')
      .single();
    if (insertError) throw new Error('Failed to create the payment record');

    return NextResponse.json({
      key: merchantKey,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      hash,
      payuUrl: process.env.NEXT_PUBLIC_PAYU_URL || 'https://secure.payu.in/_payment',
      paymentId: payment.id
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 });
  }
}

function safeReturnUrl(value: string | undefined): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';
  try {
    const candidate = new URL(value || '/console', site);
    if (candidate.origin !== new URL(site).origin) return new URL('/console', site).toString();
    return candidate.toString();
  } catch {
    return new URL('/console', site).toString();
  }
}
