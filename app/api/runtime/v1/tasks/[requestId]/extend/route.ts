import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken } from '@/lib/bluePayg';
import { extendBlueRuntimeTask } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: { requestId: string } }) {
  try {
    const account = await authenticateBlueKey(getBearerToken(request));
    const body = await request.json().catch(() => ({})) as { extension_id?: unknown };
    const result = await extendBlueRuntimeTask(
      account,
      decodeURIComponent(context.params.requestId),
      request.headers.get('x-blue-device-id') || '',
      String(body.extension_id || '')
    );
    return NextResponse.json(result, {
      status: result.credential ? 200 : 202,
      headers: noStoreHeaders()
    });
  } catch (error) {
    const status = Math.max(400, Math.min(599, Number((error as { status?: number })?.status || 500)));
    const message = error instanceof Error ? error.message : 'Blue runtime extension failed';
    if (status >= 500) console.error('[Blue Runtime] Extension failed:', message);
    return NextResponse.json({ error: message }, { status, headers: noStoreHeaders() });
  }
}

function noStoreHeaders(): Record<string, string> {
  return { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
}
