import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized: Missing token' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) {
    return { user: null, error: 'Internal Server Error: Supabase Admin not configured' };
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { user: null, error: 'Unauthorized: Invalid token' };
  }

  return { user, error: null };
}

export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database admin client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = body.couponCode || body.code;
    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return NextResponse.json({ error: 'Please enter a valid coupon code.' }, { status: 400 });
    }

    const couponCode = rawCode.trim().toUpperCase();

    // 1. Fetch coupon from `coupons` table
    const { data: coupon, error: couponError } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', couponCode)
      .single();

    if (couponError || !coupon) {
      return NextResponse.json({ error: 'Invalid coupon code. Please check and try again.' }, { status: 404 });
    }

    // 2. Check if active
    if (!coupon.is_active) {
      return NextResponse.json({ error: 'This coupon code is no longer active.' }, { status: 400 });
    }

    // 3. Check validity period
    const now = Date.now();
    if (coupon.valid_from && now < Number(coupon.valid_from)) {
      return NextResponse.json({ error: 'This coupon code is not active yet.' }, { status: 400 });
    }
    if (coupon.expires_at && now > Number(coupon.expires_at)) {
      return NextResponse.json({ error: 'This coupon code has expired.' }, { status: 400 });
    }

    // 4. Check max usage limit
    if (coupon.max_uses && coupon.max_uses > 0 && (coupon.times_used || 0) >= coupon.max_uses) {
      return NextResponse.json({ error: 'This coupon code has reached its maximum usage limit.' }, { status: 400 });
    }

    // 5. Check per-user redemption limit
    const { data: existingRedemptions } = await supabaseAdmin
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_code', couponCode)
      .eq('user_id', user.id);

    const perUserLimit = coupon.per_user_limit || 1;
    if (existingRedemptions && existingRedemptions.length >= perUserLimit) {
      return NextResponse.json({ error: 'You have already redeemed this coupon code.' }, { status: 400 });
    }

    // 6. Get reward amount
    const rewardAmount = Number(coupon.reward_amount || 0);
    if (rewardAmount <= 0) {
      return NextResponse.json({ error: 'Invalid coupon reward amount.' }, { status: 400 });
    }

    // 7. Update user wallet balance
    const { data: walletData } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    const currentBalance = Number(walletData?.balance || 0);
    const newBalance = currentBalance + rewardAmount;

    const { error: walletError } = await supabaseAdmin
      .from('wallets')
      .upsert({
        user_id: user.id,
        balance: newBalance
      }, { onConflict: 'user_id' });

    if (walletError) {
      return NextResponse.json({ error: 'Failed to update wallet balance. Please try again.' }, { status: 500 });
    }

    // 8. Record redemption log
    await supabaseAdmin.from('coupon_redemptions').insert({
      coupon_code: couponCode,
      user_id: user.id,
      user_email: user.email,
      redeemed_at: now
    });

    // 9. Increment times_used
    await supabaseAdmin.from('coupons').update({
      times_used: (coupon.times_used || 0) + 1
    }).eq('id', coupon.id);

    return NextResponse.json({
      success: true,
      rewardAmount,
      newBalance,
      message: `Successfully claimed ${rewardAmount} IMR credits!`
    });

  } catch (err: any) {
    console.error('Claim coupon error:', err);
    return NextResponse.json({ error: err.message || 'Server error claiming coupon' }, { status: 500 });
  }
}
