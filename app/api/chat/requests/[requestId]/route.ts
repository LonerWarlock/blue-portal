import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken, statusError } from '@/lib/bluePayg';
import { requestBlueGatewayCancellation } from '@/lib/blueRequestCancellation';

export const runtime = 'nodejs';

export async function DELETE(request: Request, context: { params: { requestId: string } }) {
  try {
    const requestId = String(context.params.requestId || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(requestId)) {
      throw statusError(400, 'Invalid Blue request ID');
    }
    const account = await authenticateBlueKey(getBearerToken(request));
    const result = await requestBlueGatewayCancellation(account, requestId);
    return NextResponse.json({ request_id: requestId, ...result }, {
      status: result.status === 'not_found' ? 404 : 202,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not cancel Blue request' },
      { status: status >= 400 && status <= 599 ? status : 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
