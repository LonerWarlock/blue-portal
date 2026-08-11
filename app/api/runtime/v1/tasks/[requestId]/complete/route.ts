import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken, statusError } from '@/lib/bluePayg';
import { completeBlueRuntimeTask, RuntimeClientUsage } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: { requestId: string } }) {
  try {
    const account = await authenticateBlueKey(getBearerToken(request));
    const body = await boundedJson(request);
    const rawOutcome = String(body.outcome || 'completed');
    if (!['completed', 'failed', 'stopped', 'expired'].includes(rawOutcome)) {
      throw statusError(400, 'Invalid Blue runtime completion outcome');
    }
    const usage = body.usage && typeof body.usage === 'object' && !Array.isArray(body.usage)
      ? body.usage as RuntimeClientUsage
      : {};
    const result = await completeBlueRuntimeTask(
      account,
      decodeURIComponent(context.params.requestId),
      request.headers.get('x-blue-device-id') || '',
      rawOutcome as 'completed' | 'failed' | 'stopped' | 'expired',
      usage
    );
    return NextResponse.json(result, { headers: noStoreHeaders() });
  } catch (error) {
    const status = Math.max(400, Math.min(599, Number((error as { status?: number })?.status || 500)));
    const message = error instanceof Error ? error.message : 'Blue runtime completion failed';
    if (status >= 500) console.error('[Blue Runtime] Completion failed:', message);
    return NextResponse.json({ error: message }, { status, headers: noStoreHeaders() });
  }
}

async function boundedJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 8_192) throw statusError(413, 'Blue runtime completion payload is too large');
  try {
    const value = JSON.parse(text || '{}');
    return value && !Array.isArray(value) && typeof value === 'object' ? value : {};
  } catch {
    throw statusError(400, 'Invalid Blue runtime completion payload');
  }
}

function noStoreHeaders(): Record<string, string> {
  return { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
}

