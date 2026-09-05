import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return json({ error: 'Subscription service unavailable' }, 503);
    }

    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) return json({ error: 'Sign in to check your subscription' }, 401);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ error: 'Unable to verify your session' },
        authError && authError.status && authError.status >= 500 ? 503 : 401);
    }
    const userId = authData.user.id;

    // Check if the authenticated user has active Blue Pro (PAYG).
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('account_type, blue_credits')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('blue_profiles')
      .select('status, access_tier')
      .eq('user_id', userId)
      .maybeSingle();

    const isProActive = walletData?.account_type === 'pro_payg' && profileData?.status === 'active';

    // Look up subscription record for discount and legacy plan info.
    const { data: subData, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('plan, status, current_period_end, metadata')
      .eq('user_id', userId)
      .maybeSingle();

    if (subscriptionError) return json({ error: 'Subscription lookup unavailable' }, 503);

    const discount = Number(subData?.metadata?.imr_discount || 0);

    if (isProActive) {
      return json({ plan: 'blue_pro', is_pro: true, discount });
    }

    if (!subData) {
      if (walletError || profileError) return json({ error: 'Subscription lookup unavailable' }, 503);
      return json({ plan: 'lite', is_pro: false, discount });
    }

    const hasExpired = subData.current_period_end
      ? new Date(subData.current_period_end).getTime() <= Date.now()
      : false;

    const isActive = subData.status === 'active' && !hasExpired;
    const plan = isActive ? (subData.plan || 'lite') : 'lite';
    if (plan === 'lite' && (walletError || profileError)) {
      return json({ error: 'Subscription lookup unavailable' }, 503);
    }

    return json({ plan, is_pro: false, discount });
  } catch (err) {
    console.error('Subscription check error:', err);
    return json({ error: 'Subscription service unavailable' }, 503);
  }
}
