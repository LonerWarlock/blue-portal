import {NextResponse} from 'next/server';
import {verifiedSessionUser,ACCOUNT_NO_STORE_HEADERS} from '@/lib/accountEntitlements';
import {organizationList,organizationRpc,requireOrganizationsEnabled} from '@/lib/organizations';
import {checkRateLimit} from '@/lib/trafficControl';
export const dynamic='force-dynamic';
export async function GET(request:Request) {try{const user_id=await verifiedSessionUser(request);return NextResponse.json({user_id,organizations:await organizationList(user_id)},{headers:ACCOUNT_NO_STORE_HEADERS});}catch(e){return failure(e);}}
export async function POST(request:Request) {try{requireOrganizationsEnabled();const actor=await verifiedSessionUser(request);
 const limit=await checkRateLimit('organization:create',actor,{limit:5,windowSeconds:3600});if(!limit.allowed)return NextResponse.json({error:'Please wait before creating another organization.'},{status:429});
 const body=await request.json();if(typeof body.name!=='string'||!body.name.trim()||body.name.length>100)return NextResponse.json({error:'Enter an Organization name (up to 100 characters).'},{status:400});
 return NextResponse.json({id:await organizationRpc('blue_organization_create',{actor,organization_name:body.name})},{headers:ACCOUNT_NO_STORE_HEADERS});}catch(e){return failure(e);}}
function failure(e:unknown){return NextResponse.json({error:e instanceof Error?e.message:'Organization service unavailable'},{status:Number((e as {status?:number}).status)||503,headers:ACCOUNT_NO_STORE_HEADERS});}
