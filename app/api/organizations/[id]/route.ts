import {NextResponse} from 'next/server';
import {randomBytes,createHash} from 'crypto';
import {verifiedSessionUser,ACCOUNT_NO_STORE_HEADERS} from '@/lib/accountEntitlements';
import {organizationId,organizationRpc,organizationPayuTestAccount} from '@/lib/organizations';
import {checkRateLimit} from '@/lib/trafficControl';
import {enqueueEmailJob,emailJobIdempotencyKey,sendEmailViaResend} from '@/lib/jobOutbox';
import {canonicalUrl} from '@/lib/seo';
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
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  const invitationId = await organizationRpc('blue_organization_invite', { actor, org: id, invite_email: email, hash_param: hash });
  const link = canonicalUrl('/organizations/invite') + '#' + token;
  const message = {
    to: email,
    subject: 'You’re invited to join an organization in Blue',
    html: '<p>You have been invited to join an organization in Blue.</p><p><a href="' + link + '">Accept invitation</a></p><p>Sign in with the email address that received this invitation. The link expires in seven days.</p>',
    text: 'Accept your Blue Organization invitation: ' + link + '\n\nSign in with the email address that received this invitation. The link expires in seven days.',
    organizationInvitationId: String(invitationId),
    // Resend remembers the same delivery key for 24 hours. Stay inside that window.
    organizationInvitationRetryBefore: new Date(Date.now() + 23.95 * 3600_000).toISOString()
  };
  const key = emailJobIdempotencyKey('organization-invite', [message.organizationInvitationId]);
  const reply = (notice: string, shareLink = false) => NextResponse.json({ id: invitationId, notice, ...(shareLink ? { invite_url: link } : {}) }, { headers: ACCOUNT_NO_STORE_HEADERS });
  try {
    await sendEmailViaResend(message, key);
    return reply('Invitation emailed to ' + email + '.');
  } catch {
    if (process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()) {
      try {
        await enqueueEmailJob(message, key);
        return reply('Invitation created. Email delivery will be retried. You can share the link now.', true);
      } catch { /* The invitation remains valid and can be shared directly. */ }
    }
    return reply('Invitation created. Email could not be sent. Share the link with the intended recipient.', true);
  }
 } else if(body.action==='revoke')value=await organizationRpc('blue_organization_revoke_invite',{actor,org:id,invitation:organizationId(body.invitation_id)});
 else if(body.action==='cap'||body.action==='remove') {
  if(body.action==='cap'&&body.cap!==null&&(typeof body.cap!=='number'||!Number.isFinite(body.cap)||body.cap<0||body.cap>100000000))return NextResponse.json({error:'Enter a non-negative spending cap, or No limit.'},{status:400});
  value=await organizationRpc('blue_organization_member_update',{actor,org:id,member:organizationId(body.user_id),remove_param:body.action==='remove',cap_param:body.action==='cap'?body.cap:null});
 } else return NextResponse.json({error:'Unknown Organization action'},{status:400});
 return NextResponse.json({ok:value},{headers:ACCOUNT_NO_STORE_HEADERS});
 }catch(e){return failure(e);}}
function failure(e:unknown){return NextResponse.json({error:e instanceof Error?e.message:'Organization service unavailable'},{status:Number((e as {status?:number}).status)||503,headers:ACCOUNT_NO_STORE_HEADERS});}
