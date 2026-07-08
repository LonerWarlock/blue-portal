import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';

export async function POST(request: Request) {
  try {
    const { sessionId, returnUrl, redeemedImr } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    const appliedImr = Number(redeemedImr || 0);
    if (isNaN(appliedImr) || appliedImr < 0 || appliedImr > 100) {
      return NextResponse.json({ error: 'Invalid IMR amount. You can apply between 0 and 100 IMR.' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database admin client not configured' }, { status: 500 });
    }

    // 1. Fetch the checkout session row
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 });
    }

    // 2. Query available wallet balance securely on the server to prevent fraud
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', session.user_id)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Could not fetch wallet balance' }, { status: 500 });
    }

    const userBalance = Number(wallet.balance || 0);
    if (appliedImr > userBalance) {
      return NextResponse.json({ error: `Insufficient IMR balance. You only have ${userBalance} IMR available.` }, { status: 400 });
    }

    // Calculate dynamic pricing (base is ₹149)
    const basePrice = 149;
    const discount = appliedImr * 0.5;
    const finalPrice = Math.max(1, basePrice - discount); // keep minimum transaction at ₹1 for payment gateway integration
    const amountStr = finalPrice.toFixed(2);

    // 3. Generate a unique transaction ID (txnid)
    const txnid = 'c2c_' + Math.random().toString(36).substring(2, 11) + Date.now().toString().slice(-7);

    // Save the txnid, applied IMR, and discount securely back to the session's metadata
    const existingMetadata = session.metadata || {};
    const updatedMetadata = { 
      ...existingMetadata, 
      txnid, 
      return_url: returnUrl || '',
      redeemed_imr: appliedImr,
      imr_discount: discount
    };

    await supabaseAdmin
      .from('checkout_sessions')
      .update({ metadata: updatedMetadata })
      .eq('id', sessionId);

    // 4. Load PayU credentials from environment
    const key = process.env.PAYU_MERCHANT_KEY || '';
    const salt = process.env.PAYU_MERCHANT_SALT || '';
    const payuUrl = process.env.NEXT_PUBLIC_PAYU_URL || 'https://secure.payu.in/_payment';

    if (!key || !salt) {
      return NextResponse.json({ error: 'PayU credentials are not configured in environment variables' }, { status: 500 });
    }

    // Fetch user email
    let email = existingMetadata.email || '';
    if (!email) {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(session.user_id);
        email = user?.email || '';
      } catch {
        // Fallback
      }
    }

    const productinfo = 'Blue Subscription';
    const firstname = email ? email.split('@')[0] : 'Customer';

    // 5. Calculate SHA-512 PayU Signature Hash
    // Pattern: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|SALT
    const hashString = `${key}|${txnid}|${amountStr}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    const hash = createHash('sha512').update(hashString).digest('hex');

    return NextResponse.json({
      key,
      txnid,
      amount: amountStr,
      productinfo,
      firstname,
      email,
      hash,
      payuUrl
    });

  } catch (err: any) {
    console.error('PayU Create Hash Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
