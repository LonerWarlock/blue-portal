import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'DB admin client missing' }, { status: 500 });
    }

    const cleanEmail = email.trim().toLowerCase();
    let userId: string | null = null;

    // 1. Try finding user ID via GoTrue Admin API
    try {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (users && !listError) {
        const matchedUser = users.find(u => u.email?.toLowerCase() === cleanEmail);
        if (matchedUser) {
          userId = matchedUser.id;
        }
      }
    } catch (e) {
      console.error('listUsers lookup error:', e);
    }

    // 2. Fallback to checkout_sessions metadata if Admin API is unavailable
    if (!userId) {
      try {
        const { data: sessions } = await supabaseAdmin
          .from('checkout_sessions')
          .select('user_id')
          .eq('metadata->>email', cleanEmail)
          .limit(1);
        if (sessions && sessions.length > 0) {
          userId = sessions[0].user_id;
        }
      } catch (e) {
        console.error('checkout_sessions metadata lookup error:', e);
      }
    }

    if (!userId) {
      return NextResponse.json({ plan: 'lite', discount: 0 });
    }

    // 3. Check if user has active Blue Pro (PAYG)
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

    // 4. Look up subscription record for discount and legacy plan info
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
