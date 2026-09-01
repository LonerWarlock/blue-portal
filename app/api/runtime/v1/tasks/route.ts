import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken, statusError } from '@/lib/bluePayg';
import { admitBlueRuntimeTask, assertBlueRuntimeAdmissionEnabled, publicBlueRuntimeError } from '@/lib/blueRuntime';
import { checkRateLimit, rateLimitHeaders } from '@/lib/trafficControl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORBIDDEN_CONTENT_FIELDS = ['messages', 'prompt', 'source', 'tools', 'history', 'memory', 'content', 'tool_output'];

export async function POST(request: Request) {
  try {
    if (String(process.env.DISABLE_AI_ADMISSION || '').toLowerCase() === 'true') {
      return NextResponse.json({ error: 'New Blue tasks are temporarily paused.' }, { status: 503 });
    }
    const account = await authenticateBlueKey(getBearerToken(request));
    const admissionLimit = await checkRateLimit(
      `runtime:admit:${account.accessTier}`,
      account.userId,
      { limit: account.accessTier === 'trial' ? 20 : 60, windowSeconds: 60 }
    );
    if (!admissionLimit.allowed) {
      return NextResponse.json({
        error: admissionLimit.configured ? 'Too many Blue task requests. Retry shortly.' : 'Blue admission is temporarily unavailable.',
        code: admissionLimit.configured ? 'rate_limited' : 'dependency_unavailable'
      }, {
        status: admissionLimit.configured ? 429 : 503,
        headers: rateLimitHeaders(admissionLimit)
      });
    }
    const body = await boundedJson(request);
    for (const field of FORBIDDEN_CONTENT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        throw statusError(400, `Blue runtime admission never accepts '${field}' content`);
      }
    }
    const deviceId = request.headers.get('x-blue-device-id') || String(body.device_id || '');
    await assertBlueRuntimeAdmissionEnabled(account.userId, String(body.request_id || ''));
    const admission = await admitBlueRuntimeTask(account, {
      requestId: String(body.request_id || ''),
      model: String(body.model || ''),
      mode: body.mode === 'ui_max' ? 'ui_max' : 'normal',
      requestedCreditCeiling: Number(body.requested_credit_ceiling || 0) || undefined,
      clientVersion: String(body.client_version || ''),
      deviceId,
      runtimeProtocolVersion: Number(body.runtime_protocol_version || 0) || undefined
    });
    return NextResponse.json(admission, {
      status: admission.state === 'active' && admission.credential ? 200 : 202,
      headers: noStoreHeaders(admission.retry_after_ms)
    });
  } catch (error) {
    return runtimeError(error);
  }
}

async function boundedJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 16_384) throw statusError(413, 'Blue runtime admission payload is too large');
  try {
    const value = JSON.parse(text || '{}');
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('object required');
    return value as Record<string, unknown>;
  } catch {
    throw statusError(400, 'Invalid Blue runtime admission payload');
  }
}

function runtimeError(error: unknown) {
  const status = Math.max(400, Math.min(599, Number((error as { status?: number })?.status || 500)));
  const message = publicBlueRuntimeError(error, 'Blue runtime admission failed');
  if (status >= 500) console.error('[Blue Runtime] Admission failed:', message);
  const queueFull = status === 429 && /queue is full|capacity/i.test(message);
  return NextResponse.json({
    error: message,
    ...(queueFull ? { code: 'capacity_reached' } : {})
  }, {
    status,
    headers: noStoreHeaders(queueFull ? 5_000 : undefined)
  });
}

function noStoreHeaders(retryAfterMs?: number): Record<string, string> {
  return {
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    ...(retryAfterMs ? { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } : {})
  };
}
