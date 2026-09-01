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
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const requestedDays = Number.parseInt(searchParams.get('days') || '30', 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 1), 100);
    const offset = Math.max(Number.isFinite(requestedOffset) ? requestedOffset : 0, 0);
    const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 30, 1), 365);

    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [usageResult, summaryResult] = await Promise.all([
      supabaseAdmin
        .from('billing_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('account_type', 'pro_payg')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabaseAdmin.rpc('blue_usage_summary', {
        user_id_param: user.id,
        since_param: since,
      }),
    ]);

    if (usageResult.error || summaryResult.error) {
      return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
    }
    const summary = summaryResult.data || {};

    return NextResponse.json({
      usage: usageResult.data || [],
      total_count: Number(summary.total_requests || 0),
      summary: {
        total_requests: Number(summary.total_requests || 0),
        total_blue_credits_used: Number(summary.total_blue_credits_used || 0),
        model_breakdown: summary.model_breakdown || {},
        period_days: days
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
