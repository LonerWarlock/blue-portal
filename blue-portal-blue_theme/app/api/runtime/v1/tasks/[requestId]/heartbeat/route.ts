import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken } from '@/lib/bluePayg';
import { heartbeatBlueRuntimeTask, publicBlueRuntimeError } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Control-plane activity signal only: it never accepts task content. */
export async function POST(request: Request, context: { params: { requestId: string } }) {
  try {
    const account = await authenticateBlueKey(getBearerToken(request));
    await heartbeatBlueRuntimeTask(
      account,
      decodeURIComponent(context.params.requestId),
      request.headers.get('x-blue-device-id') || ''
    );
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
    });
  } catch (error) {
    const status = Math.max(400, Math.min(599, Number((error as { status?: number })?.status || 500)));
    return NextResponse.json(
      { error: publicBlueRuntimeError(error, 'Blue runtime activity check failed') },
      { status, headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } }
    );
  }
}
