import { supabaseAdmin } from './supabaseAdmin';
import type { RateLimitResult } from './trafficControl';

/** Shared control-plane limiting without burning Redis commands on polling. */
export async function checkBlueControlRateLimit(userId: string, scope: 'status' | 'admit:trial' | 'admit:paid', identity = ''): Promise<RateLimitResult> {
  const limit = scope === 'status' ? 30 : scope === 'admit:trial' ? 20 : 60;
  const unavailable = { configured: false, allowed: false, limit, remaining: 0, retryAfterSeconds: 30 };
  if (!supabaseAdmin) return unavailable;
  try {
    const { data, error } = await supabaseAdmin.rpc('limit_blue_runtime_control', {
      user_id_param: userId, scope_param: scope, identity_param: identity
    });
    if (error || !data || typeof data.allowed !== 'boolean' || !Number.isInteger(data.remaining)
      || data.remaining < 0 || data.remaining >= limit || !Number.isInteger(data.retry_after_seconds)
      || data.retry_after_seconds < 0 || data.retry_after_seconds > 60
      || (data.allowed ? data.retry_after_seconds !== 0 : data.remaining !== 0 || data.retry_after_seconds < 1)) return unavailable;
    return { configured: true, allowed: data.allowed, limit, remaining: data.remaining, retryAfterSeconds: data.retry_after_seconds };
  } catch { return unavailable; }
}
