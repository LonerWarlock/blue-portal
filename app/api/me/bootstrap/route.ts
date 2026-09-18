import { NextResponse } from 'next/server';
import { statusError } from '@/lib/bluePayg';
import { verifiedSessionUser } from '@/lib/accountEntitlements';
import { getPackCatalog, getPackConfig } from '@/lib/exchangeRate';
import { isLowBalance, lowBalanceThreshold } from '@/lib/openrouter';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getOrCreateUserKey } from '@/lib/userKey';
import { effectiveAccountPlan } from '@/lib/accountPlan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) throw statusError(503, 'Database is not configured');
    const userId = await verifiedSessionUser(request);

    const [walletResult, profileResult, subscriptionResult] = await Promise.all([
      supabaseAdmin
        .from('wallets')
        .select('balance, account_type, blue_credits')
        .eq('user_id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('blue_profiles')
        .select('status, access_tier, total_credits_purchased, total_credits_used, last_top_up_credits, created_at')
        .eq('user_id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('subscriptions')
        .select('plan, status, current_period_end, metadata')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (walletResult.error || profileResult.error) {
      throw statusError(500, 'Failed to load account data');
    }

    if (subscriptionResult.error) throw statusError(503, 'Subscription lookup temporarily unavailable');

    const wallet = walletResult.data;
    const profile = profileResult.data;
    const subscription = subscriptionResult.error ? null : subscriptionResult.data;
    const effectivePlan = effectiveAccountPlan(wallet, profile, subscription);
    const activeBluePro = wallet?.account_type === 'pro_payg'
      && profile?.status === 'active';
    const discount = Number(subscription?.metadata?.imr_discount || 0);

    // Balance revalidation skips keys, purchase history and usage queries.
    if (new URL(request.url).searchParams.get('scope') === 'wallet') {
      const balance = Math.max(0, Number(wallet?.blue_credits || 0));
      const threshold = lowBalanceThreshold(Math.max(0, Number(profile?.last_top_up_credits || 0)) || 1);
      return NextResponse.json({
        user_id: userId, wallet: { balance: Number(wallet?.balance || 0) },
        subscription: { ...effectivePlan, discount },
        blue_pro: activeBluePro ? { wallet: {
          eligible: effectivePlan.is_pro, account_type: 'pro_payg', status: profile?.status,
          access_tier: effectivePlan.is_pro ? profile?.access_tier === 'full' ? 'full' : 'trial' : 'none',
          blue_credits: balance, exhausted: balance <= 0,
          low_balance_threshold: threshold, low_balance: isLowBalance(balance, threshold),
          renewal_url: '/blue-pro/checkout',
        } } : null,
      }, { headers: PRIVATE_NO_STORE_HEADERS });
    }

    let bluePro = null;
    if (activeBluePro) {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      let key = null;
      try {
        key = await getOrCreateUserKey(userId);
      } catch {
        console.warn('[bootstrap] Blue API key is temporarily unavailable');
      }

      const [paymentsResult, usageResult, summaryResult] = await Promise.all([
        supabaseAdmin
          .from('credit_payments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabaseAdmin
          .from('billing_transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('account_type', 'pro_payg')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50),
        supabaseAdmin.rpc('blue_usage_summary', {
          user_id_param: userId,
          since_param: since,
        }),
      ]);

      if (paymentsResult.error || usageResult.error || summaryResult.error) {
        console.warn('[bootstrap] optional Blue Pro activity is partially unavailable', {
          payments: Boolean(paymentsResult.error),
          usage: Boolean(usageResult.error),
          summary: Boolean(summaryResult.error),
        });
      }

      const balance = Math.max(0, Number(wallet?.blue_credits || 0));
      const threshold = lowBalanceThreshold(Math.max(0, Number(profile?.last_top_up_credits || 0)) || 1);
      const usageRows = usageResult.error ? [] : (usageResult.data || []);
      const summary = summaryResult.error
        ? summarizeUsageRows(usageRows)
        : summaryResult.data;
      bluePro = {
        wallet: {
          eligible: effectivePlan.is_pro,
          account_type: 'pro_payg',
          access_tier: effectivePlan.is_pro ? profile?.access_tier === 'full' ? 'full' : 'trial' : 'none',
          blue_credits: balance,
          total_purchased: Number(profile?.total_credits_purchased || 0),
          total_used: Number(profile?.total_credits_used || 0),
          status: profile?.status || 'active',
          created_at: profile?.created_at,
          low_balance_threshold: threshold,
          low_balance: isLowBalance(balance, threshold),
          exhausted: balance <= 0,
          renewal_url: '/blue-pro/checkout',
        },
        key,
        transactions: paymentsResult.error ? [] : (paymentsResult.data || []),
        usage: {
          usage: usageRows,
          total_count: Number(summary?.total_requests || 0),
          summary: {
            total_requests: Number(summary?.total_requests || 0),
            total_blue_credits_used: Number(summary?.total_blue_credits_used || 0),
            model_breakdown: summary?.model_breakdown || {},
            period_days: 30,
          },
        },
      };
    }

    return NextResponse.json({
      user_id: userId,
      wallet: { balance: Number(wallet?.balance || 0) },
      subscription: { ...effectivePlan, discount },
      blue_pro: bluePro,
      pack_config: {
        ...getPackConfig('starter'),
        packs: getPackCatalog(),
      },
    }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Server error',
    }, { status, headers: PRIVATE_NO_STORE_HEADERS });
  }
}

function summarizeUsageRows(rows: any[]) {
  const modelBreakdown: Record<string, { requests: number; totalCost: number }> = {};
  let totalBlueCreditsUsed = 0;

  for (const row of rows) {
    const model = String(row?.model || 'unknown');
    const cost = Math.max(0, Number(row?.blue_credits_cost ?? row?.cost ?? 0));
    const current = modelBreakdown[model] || { requests: 0, totalCost: 0 };
    current.requests += 1;
    current.totalCost += cost;
    modelBreakdown[model] = current;
    totalBlueCreditsUsed += cost;
  }

  return {
    total_requests: rows.length,
    total_blue_credits_used: totalBlueCreditsUsed,
    model_breakdown: modelBreakdown,
  };
}
