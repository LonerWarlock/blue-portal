import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'DB admin client missing' }, { status: 500 });
    }

    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) return NextResponse.json({ plan: 'lite', is_pro: false, discount: 0 });
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ plan: 'lite', is_pro: false, discount: 0 });
    }
    const userId = authData.user.id;

    // Check if the authenticated user has active Blue Pro (PAYG).
    const { data: walletData } = await supabaseAdmin
      .from('wallets')
      .select('account_type, blue_credits')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: profileData } = await supabaseAdmin
      .from('blue_profiles')
      .select('status, access_tier')
      .eq('user_id', userId)
      .maybeSingle();

    const isProActive = walletData?.account_type === 'pro_payg' && profileData?.status === 'active';

    // Look up subscription record for discount and legacy plan info.
    const { data: subData } = await supabaseAdmin
      .from('subscriptions')
      .select('plan, status, current_period_end, metadata')
      .eq('user_id', userId)
      .maybeSingle();

    const discount = Number(subData?.metadata?.imr_discount || 0);

    if (isProActive) {
      return NextResponse.json({ plan: 'blue_pro', is_pro: true, discount });
    }

    if (!subData) {
      return NextResponse.json({ plan: 'lite', is_pro: false, discount });
    }

    const hasExpired = subData.current_period_end
      ? new Date(subData.current_period_end).getTime() <= Date.now()
      : false;

    const isActive = subData.status === 'active' && !hasExpired;
    const plan = isActive ? (subData.plan || 'lite') : 'lite';

    return NextResponse.json({ plan, is_pro: false, discount });
  } catch (err) {
    console.error('Subscription check error:', err);
    return NextResponse.json({ plan: 'lite', discount: 0 });
  }
}
