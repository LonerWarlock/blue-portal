import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import { HACKATHON_FEE_PAYU } from '@/app/hackathon/config';

export async function POST(request: Request) {
  try {
    const { sessionId, formData } = await request.json();

    if (!sessionId || !formData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database admin client not configured' }, { status: 500 });
    }

    const key = process.env.PAYU_MERCHANT_KEY || '';
    const salt = process.env.PAYU_MERCHANT_SALT || '';
    const payuUrl = process.env.NEXT_PUBLIC_PAYU_URL || 'https://secure.payu.in/_payment';

    if (!key || !salt) {
      return NextResponse.json({ error: 'PayU credentials not configured' }, { status: 500 });
    }

    // Store form data in pending_registrations
    const { error: insertError } = await supabaseAdmin
      .from('pending_registrations')
      .insert({ id: sessionId, form_data: formData });

    if (insertError) {
      console.error('Failed to store pending hackathon registration:', insertError);
      return NextResponse.json({ error: 'Failed to initialize registration' }, { status: 500 });
    }

    // Use sessionId as txnid
    const txnid = sessionId;
    const amount = HACKATHON_FEE_PAYU;
    const productinfo = 'IGNITE PVPIT 2026 - Hackathon Registration';
    const firstname = formData.leaderFirstName || 'Participant';
    const email = formData.leaderEmail || '';

    // Hash: key|txnid|amount|productinfo|firstname|email|udf1-10(empty)|SALT
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    const hash = createHash('sha512').update(hashString).digest('hex');

    return NextResponse.json({
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      hash,
      payuUrl,
    });
  } catch (err: any) {
    console.error('Hackathon PayU Hash Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
