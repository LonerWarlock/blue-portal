import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken } from '@/lib/bluePayg';
import { completeBlueRuntimeTask, publicBlueRuntimeError } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cancels queue metadata or revokes an admitted task's provider credential.
 * The extension must abort its direct OpenRouter request locally first.
 */
export async function POST(request: Request, context: { params: { requestId: string } }) {
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
    const status = Math.max(400, Math.min(599, Number((error as { status?: number })?.status || 500)));
    const message = publicBlueRuntimeError(error, 'Blue runtime cancellation failed');
    if (status >= 500) console.error('[Blue Runtime] Cancellation failed:', message);
    return NextResponse.json({ error: message }, { status, headers: noStoreHeaders() });
  }
}

function noStoreHeaders(retryAfterSeconds?: number): Record<string, string> {
  return {
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    ...(retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : {})
  };
}
