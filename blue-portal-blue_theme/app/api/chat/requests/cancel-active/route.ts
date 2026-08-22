import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken, statusError } from '@/lib/bluePayg';
import { requestBlueGatewayClientCancellation } from '@/lib/blueRequestCancellation';

export const runtime = 'nodejs';

export async function DELETE(request: Request) {
  try {
    const clientInstanceId = String(request.headers.get('x-blue-client-instance') || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(clientInstanceId)) {
      throw statusError(400, 'Invalid Blue client instance ID');
    }
    const account = await authenticateBlueKey(getBearerToken(request));
    const result = await requestBlueGatewayClientCancellation(account, clientInstanceId);
    return NextResponse.json({
      accepted: result.accepted,
      cancelled_requests: result.cancelledCount
    }, {
      status: 202,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not stop the active Blue task' },
      {
        status: status >= 400 && status <= 599 ? status : 500,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
}
