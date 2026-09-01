import { NextResponse } from 'next/server';
import { getBearerToken, getBluePaygAccount, statusError } from '@/lib/bluePayg';
import { isLowBalance } from '@/lib/openrouter';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
};

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) throw statusError(500, 'Database is not configured');
    const token = getBearerToken(request);
    if (!token) throw statusError(401, 'Unauthorized: Missing token');
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) throw statusError(401, 'Unauthorized: Invalid token');

    const account = await getBluePaygAccount(data.user.id);
    const { data: profile } = await supabaseAdmin
      .from('blue_profiles')
      .select('total_credits_purchased, total_credits_used, status, access_tier, created_at')
      .eq('user_id', data.user.id)
      .single();

    return NextResponse.json({
      eligible: true,
      account_type: 'pro_payg',
      access_tier: account.accessTier,
      blue_credits: account.balance,
      total_purchased: Number(profile?.total_credits_purchased || 0),
      total_used: Number(profile?.total_credits_used || 0),
      status: profile?.status || 'active',
      created_at: profile?.created_at,
      low_balance_threshold: account.threshold,
      low_balance: isLowBalance(account.balance, account.threshold),
      exhausted: account.balance <= 0,
      renewal_url: '/blue-pro/checkout'
    }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      { eligible: false, error: message },
      { status, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
}
