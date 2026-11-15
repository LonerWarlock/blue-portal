import {organizationId,organizationEntitlements,organizationList} from '@/lib/organizations';
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
      userId = (await authenticateBlueKey(authorization.replace(/^Bearer\s+/i, ''),{identityOnly:true})).userId;
    }
    return NextResponse.json(await selectedEntitlements(request,userId), { headers: ACCOUNT_NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Account service unavailable' }, {
      status: Number((error as { status?: number })?.status || 503), headers: ACCOUNT_NO_STORE_HEADERS,
    });
  }
}

async function selectedEntitlements(request:Request,userId:string){const id=organizationId(new URL(request.url).searchParams.get('organization_id'));return id?{...await loadAccountEntitlements(userId),credit_summary:undefined,payg_account:true,is_pro:true,plan:'blue_pro',...await organizationEntitlements(userId,id)}:loadAccountEntitlements(userId);}
