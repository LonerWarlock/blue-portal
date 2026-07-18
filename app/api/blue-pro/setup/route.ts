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

export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthUser(request);
    if (error || !user) return NextResponse.json({ error }, { status: 401 });
    if (!supabaseAdmin) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('account_type')
      .eq('user_id', user.id)
      .single();

    if (wallet?.account_type === 'pro_payg') {
      return NextResponse.json({ error: 'You already have a Blue Pro account' }, { status: 409 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({ account_type: 'pro_payg', updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to setup Blue Pro account' }, { status: 500 });
    }

    const { error: profileError } = await supabaseAdmin
      .from('blue_profiles')
      .insert({ user_id: user.id, status: 'active' });

    if (profileError) {
      console.error('Blue profile error:', profileError);
    }

    return NextResponse.json({ success: true, message: 'Blue Pro account created' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
