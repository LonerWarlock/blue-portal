import { BLUE_TEAMS_ACTIVATION_CREDITS } from './blueCreditPolicy';

export type BlueTeamsCreditEntitlement = {
  plan: 'payg' | 'solo' | 'pro' | 'business' | null;
  status: 'active' | 'inactive'; current_period_end: string | null;
  access_source: 'credits' | 'legacy_subscription' | null;
  required_purchase_credits: 25; blue_models_only: true;
  available_blue_credits: number; total_blue_credits: number;
  active_project_teams: number; agents_per_team: number; available: boolean;
};
export function inactiveBlueTeamsCreditEntitlement(available = false): BlueTeamsCreditEntitlement {
  return {plan:null,status:'inactive',current_period_end:null,access_source:null,
    required_purchase_credits:25,blue_models_only:true,available_blue_credits:0,total_blue_credits:0,
    active_project_teams:0,agents_per_team:0,available};
}
interface Database { rpc(name: string, args: Record<string, unknown>): PromiseLike<{data?:unknown;error?:unknown}>; }
/** No browser balance or lifetime-purchased counter authorizes Teams. */
export async function loadBlueTeamsCreditEntitlement(database: Database, userId: string): Promise<BlueTeamsCreditEntitlement> {
  try {
    const {data,error}=await database.rpc('blue_teams_credit_entitlement',{user_id_param:userId});
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return inactiveBlueTeamsCreditEntitlement();
    const row=data as Record<string,unknown>;
    const available=Number(row.available_blue_credits),total=Number(row.total_blue_credits);
    if (row.user_id!==userId || !Number.isFinite(available) || available<0 || !Number.isFinite(total) || total<available
      || row.required_purchase_credits!==BLUE_TEAMS_ACTIVATION_CREDITS || row.blue_models_only!==true
      || !['active','inactive'].includes(String(row.status))) return inactiveBlueTeamsCreditEntitlement();
    const source=row.access_source,plan=row.plan,expiry=row.current_period_end;
    const validCredits=source==='credits' && plan==='payg' && total>0 && expiry===null;
    const validLegacy=source==='legacy_subscription' && ['solo','pro','business'].includes(String(plan))
      && typeof expiry==='string' && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry)>Date.now();
    const active=row.status==='active' && (validCredits||validLegacy);
    return {...inactiveBlueTeamsCreditEntitlement(true),available_blue_credits:available,total_blue_credits:total,
      ...(active?{plan:plan as BlueTeamsCreditEntitlement['plan'],status:'active' as const,
        current_period_end:validLegacy?expiry as string:null,access_source:source as 'credits'|'legacy_subscription',
        active_project_teams:plan==='solo'?1:plan==='pro'?3:10,agents_per_team:plan==='solo'?3:plan==='pro'?5:8}:{})};
  } catch { return inactiveBlueTeamsCreditEntitlement(); }
}
