import {organizationId,organizationPurchasePack} from '@/lib/organizations';
import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { APPROX_USD_TO_INR, getCreditPurchasePack } from '@/lib/exchangeRate';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BLUE_CREDIT_PRICING_VERSION, BLUE_CREDIT_PRICE_INR } from '@/lib/blueCreditPricing';
import { paymentSiteOrigin } from '@/lib/paymentOrigin';

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database is not configured' }, { status: 500 });
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
    if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { returnUrl?: string; packId?: string; customCredits?: number; customInrAmount?: number; customUsdAmount?: number; organization_id?: string };
    const org=organizationId(body.organization_id);
    const pack = org ? await organizationPurchasePack(data.user.id,org,body.customCredits,'INR') : getCreditPurchasePack(body, 'INR');
    const amountINR = pack.priceINR;
    const organizationTestCheckout = Boolean(org && 'testPayuCheckout' in pack && pack.testPayuCheckout === true);
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
    const returnUrl = safeReturnUrl(body.returnUrl, paymentSiteOrigin(request.url));
    const hash = createHash('sha512')
      .update(`${merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`)
      .digest('hex');

    const { data: payment, error: insertError } = await supabaseAdmin
      .from('credit_payments')
      .insert({
        user_id: data.user.id,
        ...(org ? {organization_id:org} : {}),
        amount_paid: amountINR,
        currency: 'INR',
        credits_purchased: pack.credits,
        pack_id: pack.id,
        payment_provider: 'payu',
        provider_txnid: txnid,
        status: 'pending',
        metadata: {
          pricing_version: org ? (organizationTestCheckout ? 'organization-payu-live-inr1-test-v1' : 'organization-inr115-usd115-v1') : BLUE_CREDIT_PRICING_VERSION,
          credit_unit_price_inr: organizationTestCheckout ? amountINR / pack.credits : BLUE_CREDIT_PRICE_INR,
          ...(organizationTestCheckout ? { live_payment_test: true, original_price_inr: pack.credits * 115 } : {}),
          model_usage_usd: pack.credits,
          base_price_usd: pack.basePriceUSD, base_price_inr: pack.basePriceINR,
          platform_fee_usd: pack.platformFeeUSD, platform_fee_inr: pack.platformFeeINR,
          platform_fee_percent: pack.platformFeePercent,
          blue_credit_multiplier: pack.multiplier,
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
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: error instanceof RangeError ? 400 : 500 });
  }
}

function safeReturnUrl(value: string | undefined, site: string): string {
  try {
    const candidate = new URL(value || '/console', site);
    if (candidate.origin !== new URL(site).origin) return new URL('/console', site).toString();
    return candidate.toString();
  } catch {
    return new URL('/console', site).toString();
  }
}
