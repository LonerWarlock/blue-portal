import { NextResponse } from 'next/server';
import {
  checkRateLimit,
  privateRateLimitIdentity,
  rateLimitHeaders,
  requestIp,
  verifyTurnstile,
} from '@/lib/trafficControl';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const validEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: Request) {
  try {
    if (String(process.env.DISABLE_NEW_OTP || '').toLowerCase() === 'true') {
      return NextResponse.json({ error: 'New verification codes are temporarily paused.' }, { status: 503 });
    }
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 10_000) {
      return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const extensionClient = body.client === 'vscode-extension'
      && request.headers.get('x-blue-client') === 'vscode-extension';
    if (!validEmail(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Authentication is temporarily unavailable' }, { status: 503 });
    }

    // VS Code cannot safely host a browser CAPTCHA challenge. It uses its own
    // explicitly identified lane, protected by fail-closed distributed email,
    // IP and global limits. Browser clients must always pass Turnstile.
    if (!extensionClient) {
      const human = await verifyTurnstile({
        request,
        token: String(body.turnstileToken ?? body.captchaToken ?? ''),
        expectedAction: 'otp_send',
      });
      if (!human.success) {
        return NextResponse.json(
          { error: human.configured ? 'Human verification failed. Please try again.' : 'Human verification is temporarily unavailable.' },
          { status: human.configured ? 403 : 503 }
        );
      }
    }

    const emailIdentity = privateRateLimitIdentity(email);
    const ip = requestIp(request);
    const limits = await Promise.all([
      checkRateLimit(extensionClient ? 'otp:extension:email' : 'otp:web:email', emailIdentity, {
        limit: 3,
        windowSeconds: 60 * 60,
      }),
      checkRateLimit(extensionClient ? 'otp:extension:ip' : 'otp:web:ip', ip, {
        limit: extensionClient ? 10 : 20,
        windowSeconds: 10 * 60,
      }),
      checkRateLimit(extensionClient ? 'otp:extension:global' : 'otp:web:global', 'all', {
        limit: extensionClient ? 100 : 200,
        windowSeconds: 60,
      }),
    ]);
    const blocked = limits.find(result => !result.allowed);
    if (blocked) {
      return NextResponse.json(
        { error: blocked.configured ? 'Please wait before requesting another code.' : 'Authentication is temporarily unavailable.' },
        { status: blocked.configured ? 429 : 503, headers: rateLimitHeaders(blocked) }
      );
    }

    // Supabase Auth owns OTP generation, hashing, expiration, attempt limits,
    // user creation, and SMTP delivery. No application table stores the code.
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      console.error('[Auth] Supabase OTP send failed:', error.message);
      const rateLimited = error.status === 429 || /rate|limit|seconds/i.test(error.message || '');
      return NextResponse.json(
        { error: rateLimited ? 'Please wait before requesting another code.' : 'Could not send verification code.' },
        { status: rateLimited ? 429 : 503, headers: rateLimited ? { 'Retry-After': '60' } : undefined }
      );
    }

    // Preserve the legacy route envelope while preventing account enumeration.
    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('[Auth] OTP send route failed:', error);
    return NextResponse.json({ error: 'Could not send verification code.' }, { status: 500 });
  }
}
