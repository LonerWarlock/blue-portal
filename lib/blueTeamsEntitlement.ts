import { getBlueTeamsPlan, isBlueTeamsTier, type BlueTeamsTier } from './blueTeamsPlans';

export type BlueTeamsAccountEntitlement = {
  plan: BlueTeamsTier | null;
  status: 'active' | 'inactive';
  current_period_end: string | null;
  active_project_teams: number;
  agents_per_team: number;
};

const NO_TEAMS_ENTITLEMENT: BlueTeamsAccountEntitlement = {
  plan: null,
  status: 'inactive',
  current_period_end: null,
  active_project_teams: 0,
  agents_per_team: 0,
};

/** Convert a server-fetched subscription row into the small, browser-safe account summary. */
export function activeBlueTeamsEntitlement(subscription: unknown, now = Date.now()): BlueTeamsAccountEntitlement {
  const row = subscription as { plan?: unknown; status?: unknown; current_period_end?: unknown; metadata?: unknown } | null;
  const plan = isBlueTeamsTier(row?.plan) ? row.plan : null;
  const expiry = typeof row?.current_period_end === 'string' ? new Date(row.current_period_end) : null;
  if (!plan || row?.status !== 'active' || !expiry || !Number.isFinite(expiry.getTime()) || expiry.getTime() <= now) {
    return NO_TEAMS_ENTITLEMENT;
  }
  const catalogue = getBlueTeamsPlan(plan)!;
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
  const projectTeams = Number(metadata.active_project_teams);
  const agentsPerTeam = Number(metadata.agents_per_team);
  return {
    plan,
    status: 'active',
    current_period_end: expiry.toISOString(),
    active_project_teams: Number.isFinite(projectTeams) && projectTeams > 0 ? projectTeams : catalogue.projectTeams,
    agents_per_team: Number.isFinite(agentsPerTeam) && agentsPerTeam > 0 ? agentsPerTeam : catalogue.agentsPerTeam,
  };
}
