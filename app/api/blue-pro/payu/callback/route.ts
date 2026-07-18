import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data: Record<string, string> = {};
    formData.forEach((value, key) => { data[key] = value.toString(); });

    const { key, txnid, amount, productinfo, firstname, email, status, hash, additionalCharges } = data;
    const salt = process.env.PAYU_MERCHANT_SALT || '';

    let hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    if (additionalCharges) {
      hashString = `${additionalCharges}|${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    }

    const calculatedHash = createHash('sha512').update(hashString).digest('hex');
    if (calculatedHash !== hash) {
      console.error('PayU Blue Pro callback signature mismatch');
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const { data: payments } = await supabaseAdmin
      .from('credit_payments')
      .select('*')
      .eq('provider_txnid', txnid)
      .limit(1);

    if (!payments || payments.length === 0) {
      console.error('No payment found for txnid:', txnid);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3005'}/blue-pro/dashboard?payment=error`, 303);
    }

    const payment = payments[0];
    const metadata = (payment.metadata as any) || {};
    const returnUrl = metadata.return_url || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3005'}/blue-pro/dashboard`;

    if (status === 'success') {
      const { error: updateError } = await supabaseAdmin
        .from('credit_payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          provider_order_id: txnid
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('Failed to update payment:', updateError);
      }

      const { error: creditError } = await supabaseAdmin.rpc('add_blue_credits', {
        user_id_param: payment.user_id,
        amount_param: payment.credits_purchased
      });

      if (creditError) {
        console.error('Failed to add credits:', creditError);
      }

      const { error: profileError } = await supabaseAdmin.rpc('increment_blue_credits_purchased', {
        user_id_param: payment.user_id,
        amount_param: payment.credits_purchased
      });

      if (profileError) {
        console.error('Failed to update profile:', profileError);
      }

      return NextResponse.redirect(`${returnUrl}?payment=success&credits=${payment.credits_purchased}`, 303);
    } else {
      await supabaseAdmin
        .from('credit_payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);

      return NextResponse.redirect(`${returnUrl}?payment=failed`, 303);
    }
  } catch (err: any) {
    console.error('Blue Pro PayU callback error:', err);
    return NextResponse.json({ error: err.message || 'Callback error' }, { status: 500 });
  }
}
