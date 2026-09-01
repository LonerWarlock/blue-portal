import { createHash, randomUUID } from 'crypto';

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

const RATE_LIMIT_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('TTL', KEYS[1])",
  "return {current, ttl}"
].join('; ');

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
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '');
  const production = process.env.NODE_ENV === 'production';
  const unavailable: RateLimitResult = {
    allowed: !production,
    configured: false,
    limit: policy.limit,
    remaining: production ? 0 : policy.limit,
    retryAfterSeconds: 30
  };

  if (!url || !token) return unavailable;

  const safeScope = String(scope || 'unknown').replace(/[^a-z0-9:_-]/gi, '_').slice(0, 80);
  const safeIdentity = privateRateLimitIdentity(identity).slice(0, 40);
  const bucket = Math.floor(Date.now() / (policy.windowSeconds * 1000));
  const key = ['blue', 'rate', safeScope, String(bucket), safeIdentity].join(':');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        'EVAL',
        RATE_LIMIT_SCRIPT,
        '1',
        key,
        String(policy.windowSeconds)
      ]),
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000)
    });
    if (!response.ok) return unavailable;

    const payload = await response.json() as { result?: unknown };
    const result = Array.isArray(payload.result) ? payload.result : [];
    const count = Number(result[0]);
    const ttl = Math.max(1, Number(result[1]) || policy.windowSeconds);
    if (!Number.isFinite(count)) return unavailable;

    return {
      allowed: count <= policy.limit,
      configured: true,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - count),
      retryAfterSeconds: count <= policy.limit ? 0 : ttl
    };
  } catch {
    return unavailable;
  }
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
