import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    const {
      key, txnid, amount, productinfo, firstname, email,
      status, hash, additionalCharges
    } = data;

    const salt = process.env.PAYU_MERCHANT_SALT || '';

    // Verify reverse signature hash
    let hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    if (additionalCharges) {
      hashString = `${additionalCharges}|${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    }

    const calculatedHash = createHash('sha512').update(hashString).digest('hex');

    if (calculatedHash !== hash) {
      console.error('PayU Callback Signature Verification Failed!', { calculatedHash, receivedHash: hash });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'DB admin client missing' }, { status: 500 });
    }

    // 1. Locate checkout session using txnid inside metadata
    const { data: sessions, error: fetchError } = await supabaseAdmin
      .from('checkout_sessions')
      .select('*')
      .eq('metadata->>txnid', txnid)
      .limit(1);

    if (fetchError || !sessions || sessions.length === 0) {
      console.error('Failed to locate checkout session for txnid:', txnid, fetchError);
      return NextResponse.json({ error: 'Session not found for transaction' }, { status: 404 });
    }

    const session = sessions[0];
    const metadata = session.metadata || {};
    const returnUrl = metadata.return_url || 'http://localhost:3005/console';

    if (status === 'success') {
      // 2. Update checkout session status
      await supabaseAdmin
        .from('checkout_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);

      // 3. Deduct applied IMR credits from user's wallet
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

      // 4. Upsert Active Subscription (1 month duration)
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
          stripe_subscription_id: 'payu_' + txnid,
          stripe_customer_id: 'payu_' + (email || 'customer'),
          metadata: {
            email: email || '',
            warning_email_sent: false,
            expiry_email_sent: false
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (subError) {
        console.error('Failed to upsert active subscription row:', subError);
      }

      // Redirect user back to console with success param
      return NextResponse.redirect(`${returnUrl}?payment=success`, 303);
    } else {
      // Payment failed
      await supabaseAdmin
        .from('checkout_sessions')
        .update({ status: 'expired' })
        .eq('id', session.id);

      return NextResponse.redirect(`${returnUrl}?payment=failed`, 303);
    }

  } catch (err: any) {
    console.error('PayU Callback Error:', err);
    return NextResponse.json({ error: err.message || 'Callback error' }, { status: 500 });
  }
}
