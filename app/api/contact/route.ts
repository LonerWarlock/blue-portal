import { NextResponse } from 'next/server';
import { emailJobIdempotencyKey, enqueueEmailJob } from '@/lib/jobOutbox';
import {
  checkRateLimit,
  rateLimitHeaders,
  requestIp,
  verifyTurnstile
} from '@/lib/trafficControl';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 16_384) {
      return NextResponse.json({ error: 'Request is too large' }, { status: 413 });
    }

    const limit = await checkRateLimit(
      'contact',
      requestIp(request),
      { limit: 5, windowSeconds: 3_600 }
    );
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: limit.configured
            ? 'Too many messages. Please try again later.'
            : 'Contact form is temporarily unavailable.'
        },
        {
          status: limit.configured ? 429 : 503,
          headers: rateLimitHeaders(limit)
        }
      );
    }

    const body = await request.json() as {
      name?: unknown;
      email?: unknown;
      message?: unknown;
      turnstileToken?: unknown;
    };
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const message = String(body.message || '').trim();
    const turnstileToken = String(body.turnstileToken || '');

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }
    if (
      name.length > 100
      || message.length > 5_000
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json({ error: 'Invalid contact form data' }, { status: 400 });
    }

    const challenge = await verifyTurnstile({
      request,
      token: turnstileToken,
      expectedAction: 'contact'
    });
    if (!challenge.success) {
      return NextResponse.json(
        {
          error: challenge.configured
            ? 'Human verification failed'
            : 'Contact form is temporarily unavailable'
        },
        { status: challenge.configured ? 400 : 503 }
      );
    }

    const fiveMinuteBucket = String(Math.floor(Date.now() / 300_000));
    const html = [
      '<h2>New Blue AI contact message</h2>',
      '<p><strong>Name:</strong> ' + escapeHtml(name) + '</p>',
      '<p><strong>Email:</strong> ' + escapeHtml(email) + '</p>',
      '<p style="white-space:pre-wrap">' + escapeHtml(message) + '</p>'
    ].join('');
    await enqueueEmailJob({
      to: process.env.CONTACT_EMAIL_TO || 'team.imergene@gmail.com',
      replyTo: email,
      subject: 'New Contact Form Message from ' + name,
      html
    }, emailJobIdempotencyKey('contact', [email, message, fiveMinuteBucket]));

    return NextResponse.json(
      { success: true, message: 'Message accepted' },
      { status: 202, headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    console.error('[contact] request failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Unable to accept the message' }, { status: 503 });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character] || character);
}
