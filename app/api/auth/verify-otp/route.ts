import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitHeaders, requestIp } from '@/lib/trafficControl';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 10_000) {
      return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Email and a valid 6-digit code are required' }, { status: 400 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Authentication is temporarily unavailable' }, { status: 503 });
    }

    const limits = await Promise.all([
      checkRateLimit('otp:verify:email', email, { limit: 5, windowSeconds: 10 * 60 }),
      checkRateLimit('otp:verify:ip', requestIp(request), { limit: 30, windowSeconds: 10 * 60 }),
    ]);
    const blocked = limits.find(result => !result.allowed);
    if (blocked) {
      return NextResponse.json(
        { error: blocked.configured ? 'Too many attempts. Please request a new code later.' : 'Authentication is temporarily unavailable.' },
        { status: blocked.configured ? 429 : 503, headers: rateLimitHeaders(blocked) }
      );
    }

    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    if (error || !data.session || !data.user) {
      if (error) console.warn('[Auth] OTP verification rejected:', error.message);
      const rateLimited = error?.status === 429 || /rate|limit/i.test(error?.message || '');
      return NextResponse.json(
        { error: rateLimited ? 'Too many attempts. Please request a new code later.' : 'Invalid or expired verification code' },
        { status: rateLimited ? 429 : 400, headers: rateLimited ? { 'Retry-After': '60' } : undefined }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user,
      },
    });
  } catch (error) {
    console.error('[Auth] OTP verification route failed:', error);
    return NextResponse.json({ error: 'An error occurred during verification' }, { status: 500 });
  }
}
