import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getBearerToken } from '@/lib/bluePayg';
import { isBlueTeamsTier } from '@/lib/blueTeamsPlans';
import { checkRateLimit, rateLimitHeaders } from '@/lib/trafficControl';

export const dynamic = 'force-dynamic';

/** Save/cancel a next-period preference. This does not charge or grant access. */
export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({error:'Plan management is temporarily unavailable.'},{status:503});
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({error:'Please sign in first.'},{status:401});
    const {data:auth,error:authError}=await supabaseAdmin.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({error:'Please sign in again.'},{status:401});
    const body=await request.json().catch(()=>null);
    if (!body || Object.keys(body).some(key=>key!=='tier') || body.tier!==null && !isBlueTeamsTier(body.tier)) {
      return NextResponse.json({error:'Choose a valid next-period Teams plan.'},{status:400});
    }
    const limit=await checkRateLimit('teams:plan-change:user',auth.user.id,{limit:12,windowSeconds:600});
    if (!limit.allowed) return NextResponse.json({error:'Please wait before changing plans again.'},{status:limit.configured?429:503,headers:rateLimitHeaders(limit)});
    const {data,error}=await supabaseAdmin.rpc(body.tier===null?'cancel_blue_teams_change':'schedule_blue_teams_change',{
      user_id_param:auth.user.id,...(body.tier===null?{}:{tier_param:body.tier}),
    });
    if (error) return NextResponse.json({error:'The plan change could not be confirmed. Refresh your current plan and try again.'},{status:409});
    return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return NextResponse.json({error:'Plan management is temporarily unavailable. No payment was started.'},{status:503});
  }
}
