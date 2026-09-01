import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken } from '@/lib/bluePayg';
import { completeBlueRuntimeTask, getBlueRuntimeTask, publicBlueRuntimeError } from '@/lib/blueRuntime';
import { checkRateLimit, rateLimitHeaders } from '@/lib/trafficControl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: { requestId: string } }) {
  try {
    const account = await authenticateBlueKey(getBearerToken(request));
    const pollingLimit = await checkRateLimit(
      'runtime:status',
      `${account.userId}:${context.params.requestId}`,
      { limit: 30, windowSeconds: 60 }
    );
    if (!pollingLimit.allowed) {
      return NextResponse.json({
        error: pollingLimit.configured ? 'Task status is being polled too quickly.' : 'Task status is temporarily unavailable.',
        code: pollingLimit.configured ? 'rate_limited' : 'dependency_unavailable'
      }, {
        status: pollingLimit.configured ? 429 : 503,
        headers: rateLimitHeaders(pollingLimit)
      });
    }
    const result = await getBlueRuntimeTask(
      account,
      decodeURIComponent(context.params.requestId),
      request.headers.get('x-blue-device-id') || ''
    );
    const pending = result.state === 'queued' || result.state === 'provisioning';
    const retryAfterMs = 'retry_after_ms' in result ? result.retry_after_ms : undefined;
    return NextResponse.json(result, {
      status: pending ? 202 : 200,
      headers: noStoreHeaders(retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined)
    });
  } catch (error) {
    return runtimeError(error, 'restore');
  }
}

export async function DELETE(request: Request, context: { params: { requestId: string } }) {
  try {
    const account = await authenticateBlueKey(getBearerToken(request));
    const result = await completeBlueRuntimeTask(
      account,
      decodeURIComponent(context.params.requestId),
      request.headers.get('x-blue-device-id') || '',
      'stopped'
    );
    const pending = result.state === 'stopping';
    return NextResponse.json(result, {
      status: pending ? 202 : 200,
      headers: noStoreHeaders(pending ? result.retry_after_seconds : undefined)
    });
  } catch (error) {
    return runtimeError(error, 'stop');
  }
}

function runtimeError(error: unknown, action: string) {
  const status = Math.max(400, Math.min(599, Number((error as { status?: number })?.status || 500)));
  const message = publicBlueRuntimeError(error, `Blue runtime ${action} failed`);
  if (status >= 500) console.error(`[Blue Runtime] ${action} failed:`, message);
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders() });
}

function noStoreHeaders(retryAfterSeconds?: number): Record<string, string> {
  return {
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    ...(retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : {})
  };
}
