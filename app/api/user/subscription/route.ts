import { NextResponse } from 'next/server';
import { ACCOUNT_NO_STORE_HEADERS, loadAccountEntitlements, verifiedSessionUser } from '@/lib/accountEntitlements';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    return NextResponse.json(await loadAccountEntitlements(await verifiedSessionUser(request)), { headers: ACCOUNT_NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Account service unavailable' }, {
      status: Number((error as { status?: number })?.status || 503), headers: ACCOUNT_NO_STORE_HEADERS,
    });
  }
}
