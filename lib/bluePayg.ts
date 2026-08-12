import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isLowBalance, lowBalanceThreshold } from '@/lib/openrouter';
import { configuredBlueCreditMultiplier } from '@/lib/blueCreditPolicy';

export const BLUE_CREDIT_MULTIPLIER = configuredBlueCreditMultiplier(
  process.env.BLUE_CREDIT_MULTIPLIER
);

export function getBearerToken(request: Request): string {
  let authorization = '';
  try {
    authorization = request.headers.get('authorization')
      || request.headers.get('Authorization')
      || request.headers.get('x-api-key')
      || request.headers.get('X-Api-Key')
      || '';
  } catch {}

  if (authorization.includes(',')) {
    authorization = authorization.split(',')[0].trim();
  }

  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return authorization.trim();
}

export interface BluePaygAccount {
  userId: string;
  balance: number;
  accessTier: 'trial' | 'full';
  lastTopUpCredits: number;
  threshold: number;
}

export interface BillingSettlement {
  requestId: string;
  charged: number;
  providerCost: number;
  remaining: number;
  threshold: number;
  low: boolean;
}

export interface BillingReservation {
  requestId: string;
  reserved: number;
  remaining: number;
  status: 'pending' | 'settled' | 'released';
  accepted: boolean;
  reactivated: boolean;
}

export async function authenticateBlueKey(clientKey: string): Promise<BluePaygAccount> {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');

  let userId: string | null = null;
  const { data: keyRecord } = await supabaseAdmin
    .from('user_keys')
    .select('user_id')
    .eq('key', clientKey)
    .maybeSingle();

  if (keyRecord?.user_id) {
    userId = keyRecord.user_id;
  } else {
    const { data: userData } = await supabaseAdmin.auth.getUser(clientKey);
    if (userData?.user?.id) {
      userId = userData.user.id;
    }
  }

  if (!userId) throw statusError(401, 'Unauthorized: Invalid Blue API Key or session token');
  return getBluePaygAccount(userId);
}

export async function getBluePaygAccount(userId: string): Promise<BluePaygAccount> {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');

  // A wallet read is also a safe reconciliation boundary. Interrupted legacy
  // requests can leave expired reservations behind; this database function is
  // atomic and idempotent, so no reservation can be refunded twice.
  const { error: releaseError } = await supabaseAdmin.rpc('release_expired_blue_credit_reservations', {
    user_id_param: userId
  });
  if (releaseError) {
    console.error('[Blue PAYG] Failed to reconcile expired reservations:', releaseError.message);
    throw statusError(500, 'Failed to reconcile Blue Credits');
  }

  const [{ data: wallet, error: walletError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin.from('wallets').select('account_type, blue_credits').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('blue_profiles')
      .select('status, access_tier, total_credits_purchased, last_top_up_credits')
      .eq('user_id', userId)
      .maybeSingle()
  ]);

  if (walletError || profileError) throw statusError(500, 'Failed to load Blue Pro account');
  if (!wallet || wallet.account_type !== 'pro_payg' || !profile || Number(profile.total_credits_purchased || 0) <= 0) {
    throw statusError(403, 'Blue Pro pay-as-you-go is not active for this key');
  }
  if (profile.status === 'suspended') throw statusError(403, 'This Blue Pro account is suspended');
  if (profile.status !== 'active') throw statusError(403, 'This Blue Pro account is not active');

  const lastTopUpCredits = Math.max(0, Number(profile.last_top_up_credits || 0));
  return {
    userId,
    balance: Math.max(0, Number(wallet.blue_credits || 0)),
    accessTier: profile.access_tier === 'full' ? 'full' : 'trial',
    lastTopUpCredits,
    threshold: lowBalanceThreshold(lastTopUpCredits || 1)
  };
}

export async function reserveUsage(
  account: BluePaygAccount,
  requestId: string,
  model: string,
  amount: number
): Promise<BillingReservation> {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');
  const { data, error } = await supabaseAdmin.rpc('reserve_blue_credits', {
    user_id_param: account.userId,
    request_id_param: requestId,
    model_param: model,
    amount_param: amount
  });
  if (error) {
    if (/insufficient/i.test(error.message || '')) throw statusError(402, 'Your Blue Credits are too low for this request');
    throw statusError(500, `Could not reserve Blue Credits: ${error.message}`);
  }
  const status = data?.status === 'settled' || data?.status === 'released' ? data.status : 'pending';
  return {
    requestId: String(data?.request_id || requestId),
    reserved: Math.max(0, Number(data?.reserved || 0)),
    remaining: Math.max(0, Number(data?.remaining || 0)),
    status,
    accepted: data?.accepted === true,
    reactivated: data?.reactivated === true
  };
}

export async function settleUsage(
  account: BluePaygAccount,
  requestId: string,
  providerCost: number,
  promptTokens: number,
  completionTokens: number
): Promise<BillingSettlement> {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');
  const { data, error } = await supabaseAdmin.rpc('settle_blue_credit_reservation', {
    user_id_param: account.userId,
    request_id_param: requestId,
    provider_cost_param: providerCost,
    blue_credit_multiplier_param: BLUE_CREDIT_MULTIPLIER,
    prompt_tokens_param: Math.max(0, Math.round(promptTokens)),
    completion_tokens_param: Math.max(0, Math.round(completionTokens))
  });
  if (error) throw statusError(500, `Could not settle Blue usage: ${error.message}`);

  const remaining = Math.max(0, Number(data?.remaining || 0));
  return {
    requestId,
    charged: Math.max(0, Number(data?.charged || 0)),
    providerCost: Math.max(0, Number(data?.provider_cost ?? providerCost)),
    remaining,
    threshold: account.threshold,
    low: isLowBalance(remaining, account.threshold)
  };
}

export async function releaseUsage(account: BluePaygAccount, requestId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.rpc('release_blue_credit_reservation', {
    user_id_param: account.userId,
    request_id_param: requestId
  });
  if (error && !/not found|not pending/i.test(error.message || '')) {
    console.error('[Blue PAYG] Failed to release reservation:', error.message);
  }
}

export function statusError(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}
