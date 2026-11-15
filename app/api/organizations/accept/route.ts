import {NextResponse} from 'next/server';
import {createHash} from 'crypto';
import {verifiedSessionUser,ACCOUNT_NO_STORE_HEADERS} from '@/lib/accountEntitlements';
import {organizationRpc} from '@/lib/organizations';
export async function POST(request:Request){try{const actor=await verifiedSessionUser(request),body=await request.json();
 if(typeof body.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.token))return NextResponse.json({error:'Invalid invitation'},{status:400});
 const id=await organizationRpc('blue_organization_accept',{actor,hash_param:createHash('sha256').update(body.token).digest('hex')});
 return NextResponse.json({id},{headers:ACCOUNT_NO_STORE_HEADERS});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invitation unavailable'},{status:409,headers:ACCOUNT_NO_STORE_HEADERS});}}
