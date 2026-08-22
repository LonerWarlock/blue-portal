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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data: payments, error: payError } = await supabaseAdmin
      .from('credit_payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (payError) {
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    return NextResponse.json({ transactions: payments || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
