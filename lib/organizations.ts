import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { statusError } from '@/lib/bluePayg';
export const organizationsEnabled = () => process.env.BLUE_ORGANIZATIONS_ENABLED === 'true';
export function requireOrganizationsEnabled() { if (!organizationsEnabled()) throw statusError(503,'Organization purchases and new tasks are not enabled yet.'); }
export function organizationId(value: unknown): string | undefined {
 if (value === undefined || value === null || value === '') return undefined;
 if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw statusError(400,'Invalid Organization ID');
 return value;
}
export async function organizationRpc(name: string,args: Record<string,unknown>) {
 if (!supabaseAdmin) throw statusError(503,'Account service unavailable');
 const {data,error}=await supabaseAdmin.rpc(name,args);
 if (error) throw statusError(/access denied|owner required|email does not match/i.test(error.message)?403:409,error.message);
 return data;
}
export async function organizationContext(userId:string,id:string) { return organizationRpc('blue_organization_context',{actor:userId,org:id}); }
export async function organizationList(userId:string) {
 if (!organizationsEnabled()) return [];
 return organizationRpc('blue_organization_list',{actor:userId});
}
export async function organizationBillingAccount(userId:string,id:string) {
 const c=await organizationContext(userId,id);
 return {userId,balance:Number(c.allowance),accessTier:'full' as const,lastTopUpCredits:Number(c.purchased),threshold:.15};
}
/** Overlay only when the client explicitly selects this organization. Personal console stays personal. */
export async function organizationEntitlements(userId:string,id:string) {
 const c=await organizationContext(userId,id), available=Number(c.allowance), total=Number(c.available)+Number(c.held);
 return {organization:c, billing_context:{kind:'organization',organization_id:id,name:c.name},
  teams:{user_id:userId,plan:c.funded?'payg':null,status:c.funded?'active':'inactive',current_period_end:null,
   access_source:c.funded?'credits':null,required_purchase_credits:25,blue_models_only:true,available:true,
   available_blue_credits:available,total_blue_credits:total,active_project_teams:10,agents_per_team:8},
  blue_pro:{eligible:c.funded,account_type:'pro_payg',status:'active',access_tier:'full',blue_credits:available,
   low_balance_threshold:.15,low_balance:available<.15,exhausted:available<=0,renewal_url:'/organizations/'+id+'/admin'}};
}
export function quoteOrganizationCredits(credits:unknown) {
 if(typeof credits!=='number'||!Number.isSafeInteger(credits)||credits<50||credits>1000) throw new RangeError('Choose 50 to 1,000 whole Organization credits.');
 return {credits,priceINR:credits*115,priceUSD:Math.round(credits*115)/100};
}
/** Temporary live PayU check. Never trust an email or price supplied by the client. */
export async function organizationPayuTestAccount(userId:string):Promise<boolean> {
 if(!organizationsEnabled()||process.env.BLUE_ORGANIZATION_PAYU_TEST_ENABLED!=='true'||!supabaseAdmin) return false;
 const {data,error}=await supabaseAdmin.auth.admin.getUserById(userId);
 return !error&&!!data.user?.email_confirmed_at&&data.user.email?.trim().toLowerCase()==='omnileshkarande@gmail.com';
}
export async function organizationPurchasePack(userId:string,id:string,credits:unknown,currency?:'INR'|'USD') {
 requireOrganizationsEnabled();const c=await organizationContext(userId,id);
 if(!c.owner) throw statusError(403,'Organization owner required');
 const quote=quoteOrganizationCredits(credits);
 const testPayuCheckout=currency==='INR'&&quote.credits===50&&await organizationPayuTestAccount(userId);
 const priceINR=testPayuCheckout?1:quote.priceINR;
 return {id:'custom',name:'Blue Organization',...quote,priceINR,testPayuCheckout,accessTier:'full',
  basePriceINR:priceINR,basePriceUSD:quote.priceUSD,platformFeeUSD:0,platformFeeINR:0,platformFeePercent:0,multiplier:1};
}
