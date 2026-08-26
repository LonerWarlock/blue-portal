import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import { COURSE_FEE_PAYU } from '@/app/courses/config';

export async function POST(request: Request) {
  try {
    const { sessionId, formData, productName, customAmount, redirectPath } = await request.json();

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

    const productinfo = (productName || 'Python & Data Science Bootcamp 2026').trim();
    const amount = customAmount ? `${Number(customAmount).toFixed(2)}` : COURSE_FEE_PAYU;
    const path = redirectPath || '/courses';

    const enrichedFormData = {
      ...formData,
      productinfo,
      amount,
      redirectPath: path,
    };

    const { error: insertError } = await supabaseAdmin
      .from('pending_registrations')
      .insert({ id: sessionId, form_data: enrichedFormData });

    if (insertError) {
      console.error('Failed to store pending course registration:', insertError);
      return NextResponse.json({ error: 'Failed to initialize registration' }, { status: 500 });
    }

    const txnid = sessionId;
    const firstname = formData.firstName || 'Participant';
    const email = formData.email || '';

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
    console.error('Course PayU Hash Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
