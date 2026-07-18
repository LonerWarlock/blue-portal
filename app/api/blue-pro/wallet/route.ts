import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized: Missing token' };
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) return { user: null, error: 'DB not configured' };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { user: null, error: 'Unauthorized: Invalid token' };
  return { user, error: null };
}

export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthUser(request);
    if (error || !user) return NextResponse.json({ error }, { status: 401 });
    if (!supabaseAdmin) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('account_type, blue_credits, balance')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if (wallet.account_type !== 'pro_payg') {
      return NextResponse.json({ error: 'Not a Blue Pro account' }, { status: 403 });
    }

    const { data: profile } = await supabaseAdmin
      .from('blue_profiles')
      .select('total_credits_purchased, total_credits_used, status, created_at')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      account_type: wallet.account_type,
      blue_credits: Number(wallet.blue_credits || 0),
      imr_balance: Number(wallet.balance || 0),
      total_purchased: Number(profile?.total_credits_purchased || 0),
      total_used: Number(profile?.total_credits_used || 0),
      status: profile?.status || 'active',
      created_at: profile?.created_at
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
