import {NextResponse} from 'next/server';
import {randomBytes,createHash} from 'crypto';
import {verifiedSessionUser,ACCOUNT_NO_STORE_HEADERS} from '@/lib/accountEntitlements';
import {organizationContext,organizationId,organizationRpc,organizationPayuTestAccount} from '@/lib/organizations';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
import {checkRateLimit} from '@/lib/trafficControl';
import {enqueueEmailJob,emailJobIdempotencyKey} from '@/lib/jobOutbox';
export const dynamic='force-dynamic';
type Context={params:{id:string}};
export async function GET(request:Request,{params}:Context){try{
 const actor=await verifiedSessionUser(request),id=organizationId(params.id)!;
 const snapshot=await organizationRpc('blue_organization_admin_snapshot',{actor,org:id});
 return NextResponse.json({...snapshot,...(snapshot.organization?.owner?{checkout:{payu_test_enabled:await organizationPayuTestAccount(actor)}}:{})},{headers:ACCOUNT_NO_STORE_HEADERS});
 }catch(e){return failure(e);}}
export async function POST(request:Request,{params}:Context){try{
 const actor=await verifiedSessionUser(request),id=organizationId(params.id)!;
 const limit=await checkRateLimit('organization:manage',actor,{limit:60,windowSeconds:3600});if(!limit.allowed)return NextResponse.json({error:'Too many updates. Try again later.'},{status:429});
 const body=await request.json();let value;
 if(body.action==='invite') {
  const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
  value=await organizationRpc('blue_organization_invite',{actor,org:id,invite_email:body.email,hash_param:hash});
  const link='https://blue.imergene.in/organizations/invite#'+token;
  try{await enqueueEmailJob({to:String(body.email).trim().toLowerCase(),subject:'Invitation to your Blue Organization',html:'<p>You have been invited to a Blue Organization.</p><p><a href="'+link+'">Sign in and accept the invitation</a></p><p>This invitation expires in seven days.</p>'},emailJobIdempotencyKey('organization-invite',[String(value)]));}
  catch{return NextResponse.json({id:value,invite_url:link,notice:'Invitation created. Email delivery is unavailable; share this invitation link with the intended person.'},{headers:ACCOUNT_NO_STORE_HEADERS});}
  return NextResponse.json({id:value,invite_url:link},{headers:ACCOUNT_NO_STORE_HEADERS});
 } else if(body.action==='revoke')value=await organizationRpc('blue_organization_revoke_invite',{actor,org:id,invitation:organizationId(body.invitation_id)});
 else if(body.action==='cap'||body.action==='remove') {
  if(body.action==='cap'&&body.cap!==null&&(typeof body.cap!=='number'||!Number.isFinite(body.cap)||body.cap<0||body.cap>100000000))return NextResponse.json({error:'Enter a non-negative spending cap, or No limit.'},{status:400});
  value=await organizationRpc('blue_organization_member_update',{actor,org:id,member:organizationId(body.user_id),remove_param:body.action==='remove',cap_param:body.action==='cap'?body.cap:null});
 } else return NextResponse.json({error:'Unknown Organization action'},{status:400});
 return NextResponse.json({ok:value},{headers:ACCOUNT_NO_STORE_HEADERS});
 }catch(e){return failure(e);}}
function failure(e:unknown){return NextResponse.json({error:e instanceof Error?e.message:'Organization service unavailable'},{status:Number((e as {status?:number}).status)||503,headers:ACCOUNT_NO_STORE_HEADERS});}
