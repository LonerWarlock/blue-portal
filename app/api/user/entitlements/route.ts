import { NextResponse } from 'next/server';
import { ACCOUNT_NO_STORE_HEADERS, loadAccountEntitlements, verifiedSessionUser } from '@/lib/accountEntitlements';
import { authenticateBlueKey } from '@/lib/bluePayg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    let userId: string;
    try {
      userId = await verifiedSessionUser(request);
    } catch (error) {
      if (Number((error as { status?: number }).status) !== 401
        || request.headers.get('x-blue-credential') !== 'api-key') throw error;
      const authorization = request.headers.get('authorization') || '';
      if (!/^Bearer\s+\S+$/i.test(authorization)) throw error;
      userId = (await authenticateBlueKey(authorization.replace(/^Bearer\s+/i, ''))).userId;
    }
    return NextResponse.json(await loadAccountEntitlements(userId), { headers: ACCOUNT_NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Account service unavailable' }, {
      status: Number((error as { status?: number })?.status || 503), headers: ACCOUNT_NO_STORE_HEADERS,
    });
  }
}
