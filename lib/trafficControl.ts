import { createHash, randomUUID } from 'crypto';
import { supabaseAdmin } from './supabaseAdmin';

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  configured: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export function requestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded
    || request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

export function privateRateLimitIdentity(value: string): string {
  return createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex');
}

export async function checkRateLimit(
  scope: string,
  identity: string,
  policy: RateLimitPolicy
): Promise<RateLimitResult> {
  // Website/login/payment/contact guards use Postgres only. Upstash belongs
  // exclusively to prepaid proxy admission/settlement, never page loading.
  const unavailable: RateLimitResult = {
    allowed: false, configured: false, limit: policy.limit, remaining: 0, retryAfterSeconds: 30
  };
  if (!supabaseAdmin || !Number.isSafeInteger(policy.limit) || policy.limit < 1 || policy.limit > 10000
    || !Number.isSafeInteger(policy.windowSeconds) || policy.windowSeconds < 1 || policy.windowSeconds > 86400) return unavailable;
  const safeScope = String(scope || 'unknown').replace(/[^a-z0-9:_-]/gi, '_').slice(0, 80);
  try {
    const {data, error} = await supabaseAdmin.rpc('limit_blue_website_request', {
      scope_param: safeScope, identity_hash_param: privateRateLimitIdentity(identity),
      limit_param: policy.limit, window_seconds_param: policy.windowSeconds
    });
    if (error || !data || typeof data.allowed !== 'boolean' || !Number.isInteger(data.remaining)
      || data.remaining < 0 || data.remaining >= policy.limit || !Number.isInteger(data.retry_after_seconds)
      || data.retry_after_seconds < 0 || data.retry_after_seconds > policy.windowSeconds
      || (data.allowed ? data.retry_after_seconds !== 0 : data.remaining !== 0 || data.retry_after_seconds < 1)) return unavailable;
    return {allowed: data.allowed, configured: true, limit: policy.limit,
      remaining: data.remaining, retryAfterSeconds: data.retry_after_seconds};
  } catch { return unavailable; }
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining)
  };
  if (!result.allowed) headers['Retry-After'] = String(result.retryAfterSeconds);
  return headers;
}

export async function verifyTurnstile(input: {
  request: Request;
  token: string;
  expectedAction?: string;
}): Promise<{ success: boolean; configured: boolean }> {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || '');
  const production = process.env.NODE_ENV === 'production';
  if (!secret) return { success: !production, configured: false };
  if (!input.token || input.token.length > 2048) return { success: false, configured: true };

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: input.token,
        remoteip: requestIp(input.request),
        idempotency_key: randomUUID()
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000)
    });
    if (!response.ok) return { success: false, configured: true };

    const result = await response.json() as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    if (!result.success) return { success: false, configured: true };
    if (input.expectedAction && result.action && result.action !== input.expectedAction) {
      return { success: false, configured: true };
    }

    const allowedHosts = String(process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    if (
      production
      && allowedHosts.length > 0
      && !allowedHosts.includes(String(result.hostname || '').toLowerCase())
    ) {
      return { success: false, configured: true };
    }
    return { success: true, configured: true };
  } catch {
    return { success: false, configured: true };
  }
}
