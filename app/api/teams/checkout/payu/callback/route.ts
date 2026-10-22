import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { matchesExpectedPayuPayment, parsePayuForm, safeInternalUrl, validPayuCallbackSignature } from '@/lib/paymentSecurity';
import { paymentSiteOrigin } from '@/lib/paymentOrigin';
import { getBlueTeamsPlan, getBlueTeamsPriceInr, getBlueTeamsTierFromCheckoutPlan } from '@/lib/blueTeamsPlans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const siteUrl = paymentSiteOrigin(request.url);
  let resultUrl = new URL('/teams', siteUrl);
  let verifiedPaid = false;
  try {
    const data = parsePayuForm(await request.formData());
    const merchantKey = process.env.PAYU_MERCHANT_KEY?.trim() || '';
    const salt = process.env.PAYU_MERCHANT_SALT?.trim() || '';
    if (!merchantKey || data.key !== merchantKey || !validPayuCallbackSignature(data, salt)) {
      resultUrl.searchParams.set('payment', 'invalid');
      return NextResponse.redirect(resultUrl, 303);
    }
    if (!supabaseAdmin) return NextResponse.json({ error: 'Payment confirmation is temporarily unavailable.' }, { status: 503 });

    const { data: sessions, error } = await supabaseAdmin.from('checkout_sessions').select('*').eq('metadata->>txnid', data.txnid).limit(1);
    const session = sessions?.[0];
    if (error || !session) {
      resultUrl.searchParams.set('payment', 'invalid');
      return NextResponse.redirect(resultUrl, 303);
    }
    const metadata = (session.metadata || {}) as Record<string, any>;
    resultUrl = safeInternalUrl(metadata.return_url, siteUrl, '/teams');
    const tier = getBlueTeamsTierFromCheckoutPlan(session.plan);
    const plan = getBlueTeamsPlan(tier);
    const testMode = metadata.blue_teams_test_mode === true;
    const liveTestMode = metadata.blue_teams_live_test_mode === true;
    const testPrice = testMode || liveTestMode;
    if (!tier || !plan || session.billing_cycle !== 'monthly' || metadata.product_kind !== 'blue_teams') {
      resultUrl.searchParams.set('payment', 'invalid');
      return NextResponse.redirect(resultUrl, 303);
    }
    const expected = {
      key: String(metadata.expected_key || ''), amount: String(metadata.expected_amount || ''),
      productinfo: String(metadata.expected_productinfo || ''), firstname: String(metadata.expected_firstname || ''),
      email: String(metadata.expected_email || ''), txnid: String(metadata.txnid || ''),
    };
    const { data: order, error: orderError } = await supabaseAdmin.from('payment_orders').select('*').eq('checkout_session_id', session.id).maybeSingle();
    const redeemedImr = Number(order?.redeemed_imr);
    const matchesOrder = !orderError && order && order.user_id === session.user_id && order.gateway === 'payu'
      && order.product_sku === plan.sku && order.currency === 'INR'
      && Number.isFinite(redeemedImr) && redeemedImr >= 0 && redeemedImr <= 100
      && !(testMode && liveTestMode)
      && (!testPrice || redeemedImr === 0)
      && order.provider_order_id === data.txnid && order.custom_id === data.txnid
      && ['pending', 'completed'].includes(order.status) && metadata.payment_provider === 'payu'
      && Number(order.amount).toFixed(2) === getBlueTeamsPriceInr(tier, testMode, redeemedImr, liveTestMode)
      && Number(metadata.redeemed_imr) === redeemedImr
      && order.metadata?.blue_teams_test_mode === testMode
      && Boolean(order.metadata?.blue_teams_live_test_mode) === liveTestMode;
    if (!matchesOrder || !matchesExpectedPayuPayment(data, expected)) {
      resultUrl.searchParams.set('payment', 'invalid');
      return NextResponse.redirect(resultUrl, 303);
    }
    resultUrl.searchParams.set('test_mode', testMode ? '1' : '0');
    resultUrl.searchParams.set('live_test', liveTestMode ? '1' : '0');
    const transactionId = data.mihpayid || data.payuMoneyId || data.txnid;
    if (session.status === 'completed' && order.status === 'completed' && order.provider_transaction_id === transactionId) {
      resultUrl.searchParams.set('payment', 'success');
      return NextResponse.redirect(resultUrl, 303);
    }

    if (data.status.trim().toLowerCase() !== 'success') {
      await supabaseAdmin.from('payment_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'pending');
      await supabaseAdmin.from('checkout_sessions').update({ status: 'expired' }).eq('id', session.id).eq('status', 'pending');
      resultUrl.searchParams.set('payment', 'failed');
      return NextResponse.redirect(resultUrl, 303);
    }

    verifiedPaid = true;
    const { error: completionError } = await supabaseAdmin.rpc('complete_blue_teams_checkout', {
      session_id_param: session.id, provider_param: 'payu', provider_order_id_param: data.txnid,
      provider_transaction_id_param: transactionId,
      payer_email_param: data.email || String(metadata.email || ''),
    });
    if (completionError) throw new Error(`Could not activate Blue Teams: ${completionError.message}`);
    resultUrl.searchParams.set('payment', 'success');
    return NextResponse.redirect(resultUrl, 303);
  } catch (error) {
    console.error('[Blue Teams] PayU callback failed:', error);
    resultUrl.searchParams.set('payment', verifiedPaid ? 'pending' : 'error');
    return NextResponse.redirect(resultUrl, 303);
  }
}
