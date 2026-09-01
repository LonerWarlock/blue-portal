import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { randomBytes } from 'crypto';
import { payuRequestHash, safeInternalUrl } from '@/lib/paymentSecurity';
import { getBearerToken } from '@/lib/bluePayg';
import { checkRateLimit, rateLimitHeaders, requestIp } from '@/lib/trafficControl';

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

    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limits = await Promise.all([
      checkRateLimit('payment:payu:user', authData.user.id, { limit: 10, windowSeconds: 10 * 60 }),
      checkRateLimit('payment:payu:ip', requestIp(request), { limit: 20, windowSeconds: 10 * 60 }),
    ]);
    const blocked = limits.find(result => !result.allowed);
    if (blocked) {
      return NextResponse.json({ error: 'Too many payment attempts. Please wait and try again.' }, {
        status: blocked.configured ? 429 : 503,
        headers: rateLimitHeaders(blocked),
      });
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
    if (session.user_id !== authData.user.id) {
      return NextResponse.json({ error: 'Checkout session does not belong to this user' }, { status: 403 });
    }
    if (session.plan !== 'blue' || session.billing_cycle !== 'monthly') {
      return NextResponse.json({ error: 'Unsupported checkout session' }, { status: 400 });
    }
    if (session.status !== 'pending' || new Date(session.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Checkout session is no longer active' }, { status: 409 });
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
    const txnid = `c2c_${randomBytes(12).toString('hex')}`;

    // Save only server-derived product and payment details.
    const existingMetadata = session.metadata || {};
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const safeReturnUrl = safeInternalUrl(returnUrl, siteUrl, '/console').toString();

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

    const updatedMetadata = {
      ...existingMetadata,
      txnid,
      return_url: safeReturnUrl,
      redeemed_imr: appliedImr,
      imr_discount: discount,
      payment_provider: 'payu',
      expected_key: key,
      expected_amount: amountStr,
      expected_productinfo: productinfo,
      expected_firstname: firstname,
      expected_email: email,
    };
    const { error: expectedUpdateError } = await supabaseAdmin
      .from('checkout_sessions')
      .update({ metadata: updatedMetadata })
      .eq('id', sessionId)
      .eq('status', 'pending');
    if (expectedUpdateError) {
      return NextResponse.json({ error: 'Could not initialize payment' }, { status: 500 });
    }

    const { error: paymentOrderError } = await supabaseAdmin
      .from('payment_orders')
      .upsert({
        checkout_session_id: session.id,
        user_id: session.user_id,
        product_sku: 'blue_monthly',
        amount: amountStr,
        currency: 'INR',
        redeemed_imr: appliedImr,
        gateway: 'payu',
        provider_order_id: txnid,
        custom_id: txnid,
        status: 'pending',
        expires_at: session.expires_at,
        metadata: { productinfo, firstname, email },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'checkout_session_id' });
    if (paymentOrderError) {
      return NextResponse.json({ error: 'Could not initialize payment' }, { status: 500 });
    }

    // 5. Calculate SHA-512 PayU Signature Hash
    const hash = payuRequestHash({ key, txnid, amount: amountStr, productinfo, firstname, email }, salt);

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
