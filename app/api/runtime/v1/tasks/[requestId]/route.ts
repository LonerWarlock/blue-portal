import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken } from '@/lib/bluePayg';
import { completeBlueRuntimeTask, getBlueRuntimeTask } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: { requestId: string } }) {
  try {
    const account = await authenticateBlueKey(getBearerToken(request));
    const result = await getBlueRuntimeTask(
      account,
      decodeURIComponent(context.params.requestId),
      request.headers.get('x-blue-device-id') || ''
    );
    const pending = 'credential' in result && !result.credential;
    return NextResponse.json(result, { status: pending ? 202 : 200, headers: noStoreHeaders() });
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
    return NextResponse.json(result, { headers: noStoreHeaders() });
  } catch (error) {
    return runtimeError(error, 'stop');
  }
}

function runtimeError(error: unknown, action: string) {
  const status = Math.max(400, Math.min(599, Number((error as { status?: number })?.status || 500)));
  const message = error instanceof Error ? error.message : `Blue runtime ${action} failed`;
  if (status >= 500) console.error(`[Blue Runtime] ${action} failed:`, message);
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders() });
}

function noStoreHeaders(): Record<string, string> {
  return { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
}

