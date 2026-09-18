import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { statusError } from '@/lib/bluePayg';
import { effectiveAccountPlan } from '@/lib/accountPlan';
import { isLowBalance, lowBalanceThreshold } from '@/lib/openrouter';

export const ACCOUNT_NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function verifiedSessionUser(request: Request): Promise<string> {
  if (!supabaseAdmin) throw statusError(503, 'Account service unavailable');
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) throw statusError(401, 'Sign in to verify your account');
  const { data, error } = await supabaseAdmin.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  if (error || !data.user) {
    throw statusError(error && Number(error.status) >= 500 ? 503 : 401, 'Unable to verify your session');
  }
  return data.user.id;
}

export async function loadAccountEntitlements(userId: string) {
  if (!supabaseAdmin) throw statusError(503, 'Account service unavailable');
  const [walletResult, profileResult, subscriptionResult] = await Promise.all([
    supabaseAdmin.from('wallets').select('balance, account_type, blue_credits').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('blue_profiles').select('status, access_tier, last_top_up_credits').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('subscriptions').select('plan, status, current_period_end, metadata').eq('user_id', userId).maybeSingle(),
  ]);
  if (walletResult.error || profileResult.error || subscriptionResult.error) throw statusError(503, 'Account lookup temporarily unavailable');
  const wallet = walletResult.data;
  const profile = profileResult.data;
  const subscription = subscriptionResult.data;
  const plan = effectiveAccountPlan(wallet, profile, subscription);
  const credits = Number(wallet?.blue_credits || 0);
  const balance = Number.isFinite(credits) ? Math.max(0, credits) : 0;
  const threshold = lowBalanceThreshold(Math.max(0, Number(profile?.last_top_up_credits || 0)) || 1);
  return {
    user_id: userId, ...plan, discount: Number(subscription?.metadata?.imr_discount || 0),
    blue_pro: {
      eligible: plan.is_pro, account_type: String(wallet?.account_type || 'standard'),
      status: String(profile?.status || 'inactive'),
      access_tier: plan.is_pro ? profile?.access_tier === 'full' ? 'full' : 'trial' : 'none',
      blue_credits: balance, low_balance_threshold: threshold,
      low_balance: isLowBalance(balance, threshold), exhausted: balance <= 0,
      renewal_url: '/blue-pro/checkout',
    },
  };
}
