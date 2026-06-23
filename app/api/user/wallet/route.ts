import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Helper to authenticate user from token
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

// GET: Fetch wallet balance, auto-create if missing
export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!supabaseAdmin) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    // 1. Fetch Wallet Balance
    let { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (walletError && walletError.code === 'PGRST116') {
      // Wallet record doesn't exist, create initial free tier wallet ($1.00 credit)
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: user.id, balance: 1.00 })
        .select('balance')
        .single();

      if (createError) {
        console.error('Create wallet error:', createError);
        return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 });
      }

      walletData = newWallet;
    } else if (walletError) {
      console.error('Fetch wallet error:', walletError);
      return NextResponse.json({ error: 'Failed to retrieve wallet balance' }, { status: 500 });
    }

    return NextResponse.json({ balance: walletData?.balance || 0 });

  } catch (err: any) {
    console.error('Fetch wallet route error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
