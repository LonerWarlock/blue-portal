import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import { getUsdToInr, getPackConfig } from '@/lib/exchangeRate';

async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized: Missing token' };
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) return { user: null, error: 'DB not configured' };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { user: null, error: 'Unauthorized: Invalid token' };
  return { user, error: null };
}

export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthUser(request);
    if (error || !user) return NextResponse.json({ error }, { status: 401 });
    if (!supabaseAdmin) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    const { returnUrl } = await request.json();

    const pack = getPackConfig();
    const rate = await getUsdToInr();
    const amountINR = Math.round(pack.priceUSD * rate);

    const key = process.env.PAYU_MERCHANT_KEY || '';
    const salt = process.env.PAYU_MERCHANT_SALT || '';
    const payuUrl = process.env.NEXT_PUBLIC_PAYU_URL || 'https://secure.payu.in/_payment';

    if (!key || !salt) {
      return NextResponse.json({ error: 'PayU credentials not configured' }, { status: 500 });
    }

    let email = '';
    try {
      const { data: { user: u } } = await supabaseAdmin.auth.admin.getUserById(user.id);
      email = u?.email || '';
    } catch {}

    const txnid = 'bcp_' + Math.random().toString(36).substring(2, 11) + Date.now().toString().slice(-7);
    const amountStr = amountINR.toFixed(2);
    const productinfo = `Blue Pro ${pack.credits} Credits`;
    const firstname = email ? email.split('@')[0] : 'Customer';

    const hashString = `${key}|${txnid}|${amountStr}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    const hash = createHash('sha512').update(hashString).digest('hex');

    const { data: payment, error: insertError } = await supabaseAdmin
      .from('credit_payments')
      .insert({
        user_id: user.id,
        amount_paid: amountINR,
        currency: 'INR',
        credits_purchased: pack.credits,
        payment_provider: 'payu',
        provider_txnid: txnid,
        status: 'pending',
        metadata: {
          usd_amount: pack.priceUSD,
          exchange_rate: rate,
          return_url: returnUrl || '',
          payu_txnid: txnid
        }
      })
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    return NextResponse.json({
      key,
      txnid,
      amount: amountStr,
      productinfo,
      firstname,
      email,
      hash,
      payuUrl,
      paymentId: payment.id
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
