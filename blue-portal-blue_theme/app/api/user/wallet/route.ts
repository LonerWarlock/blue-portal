import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database is not configured' }, { status: 500 });
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
    if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', data.user.id)
      .maybeSingle();
    if (walletError) throw new Error('Failed to retrieve wallet balance');
    if (wallet) return NextResponse.json({ balance: Number(wallet.balance || 0) });

    const { data: created, error: createError } = await supabaseAdmin
      .from('wallets')
      .insert({ user_id: data.user.id, balance: 0, blue_credits: 0, account_type: 'standard' })
      .select('balance')
      .single();
    if (createError) throw new Error('Failed to create wallet');
    return NextResponse.json({ balance: Number(created.balance || 0) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 });
  }
}
