import {NextResponse} from 'next/server';
import {verifiedSessionUser,ACCOUNT_NO_STORE_HEADERS} from '@/lib/accountEntitlements';
import {organizationId,organizationContext} from '@/lib/organizations';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:{id:string}}){
 try{
  const actor=await verifiedSessionUser(request),id=organizationId(params.id)!;
  const context=await organizationContext(actor,id);
  if(!context.owner)return NextResponse.json({error:'Organization owner required'},{status:403,headers:ACCOUNT_NO_STORE_HEADERS});
  if(!supabaseAdmin)throw Error('Account service unavailable');
  const [events,payments]=await Promise.all([
   supabaseAdmin.from('blue_organization_events').select('id,created_at,kind,credits,actor_id').eq('organization_id',id).order('created_at',{ascending:false}).limit(100),
   supabaseAdmin.from('credit_payments').select('id,created_at,credits_purchased,amount_paid,currency,status').eq('organization_id',id).order('created_at',{ascending:false}).limit(50)
  ]);
  if(events.error||payments.error)throw Error('Billing records could not be loaded. Please try Refresh.');
  return NextResponse.json({events:events.data||[],payments:payments.data||[]},{headers:ACCOUNT_NO_STORE_HEADERS});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Account service unavailable'},{status:Number((e as {status?:number}).status)||503,headers:ACCOUNT_NO_STORE_HEADERS});}
}
