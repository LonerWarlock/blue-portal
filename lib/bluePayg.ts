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
  /** False only while the Portal is temporarily running against the legacy RPC contract. */
  decisionExplicit: boolean;
}

export async function authenticateBlueKey(clientKey: string): Promise<BluePaygAccount> {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');
  if (!clientKey || clientKey.length > 512) throw statusError(401, 'Unauthorized: Invalid Blue API Key or session token');

  let userId: string | null = null;
  const keyHash = await sha256Hex(clientKey);
  const { data: hashedKeyRecord, error: hashedKeyError } = await supabaseAdmin
    .from('user_keys')
    .select('user_id')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (hashedKeyRecord?.user_id) {
    userId = hashedKeyRecord.user_id;
  } else {
    // Rolling-deployment compatibility: environments that have not applied
    // migration 021 may still contain a legacy plaintext key. Once found, it
    // is upgraded in place and erased. Remove this branch after all projects
    // have been migrated.
    if (hashedKeyError && /key_hash/i.test(hashedKeyError.message || '')) {
      const { data: legacyKeyRecord } = await supabaseAdmin
        .from('user_keys')
        .select('user_id')
        .eq('key', clientKey)
        .maybeSingle();
      userId = legacyKeyRecord?.user_id || null;
    } else {
      const { data: legacyKeyRecord } = await supabaseAdmin
        .from('user_keys')
        .select('user_id, key')
        .eq('key', clientKey)
        .maybeSingle();
      if (legacyKeyRecord?.user_id) {
        userId = legacyKeyRecord.user_id;
        await supabaseAdmin.from('user_keys').update({
          key: null,
          key_hash: keyHash,
          key_prefix: clientKey.slice(0, 10),
          last_four: clientKey.slice(-4),
          rotated_at: new Date().toISOString()
        }).eq('user_id', userId);
      }
    }

    if (!userId) {
      const { data: userData } = await supabaseAdmin.auth.getUser(clientKey);
      if (userData?.user?.id) {
        userId = userData.user.id;
      }
    }
  }

  if (!userId) throw statusError(401, 'Unauthorized: Invalid Blue API Key or session token');
  return getBluePaygAccount(userId);
}

export async function getBluePaygAccount(userId: string): Promise<BluePaygAccount> {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');

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
  const decisionExplicit = typeof data?.accepted === 'boolean';
  return {
    requestId: String(data?.request_id || requestId),
    reserved: Math.max(0, Number(data?.reserved || 0)),
    remaining: Math.max(0, Number(data?.remaining || 0)),
    status,
    accepted: data?.accepted === true,
    reactivated: data?.reactivated === true,
    decisionExplicit
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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
