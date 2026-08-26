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
    const days = parseInt(searchParams.get('days') || '30');

    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data: usage, error: usageError, count } = await supabaseAdmin
      .from('billing_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('account_type', 'pro_payg')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (usageError) {
      return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
    }

    const { data: aggData } = await supabaseAdmin
      .from('billing_transactions')
      .select('model, blue_credits_cost')
      .eq('user_id', user.id)
      .eq('account_type', 'pro_payg')
      .gte('created_at', since);

    const modelBreakdown: Record<string, { requests: number; totalCost: number }> = {};
    let totalBlueCredits = 0;
    let totalRequests = 0;

    for (const row of aggData || []) {
      const cost = Number(row.blue_credits_cost || 0);
      totalBlueCredits += cost;
      totalRequests++;
      if (!modelBreakdown[row.model]) {
        modelBreakdown[row.model] = { requests: 0, totalCost: 0 };
      }
      modelBreakdown[row.model].requests++;
      modelBreakdown[row.model].totalCost += cost;
    }

    return NextResponse.json({
      usage: usage || [],
      total_count: count || 0,
      summary: {
        total_requests: totalRequests,
        total_blue_credits_used: Math.round(totalBlueCredits * 1000000) / 1000000,
        model_breakdown: modelBreakdown,
        period_days: days
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
