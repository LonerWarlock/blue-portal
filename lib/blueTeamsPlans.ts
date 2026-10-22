export type BlueTeamsTier = 'solo' | 'pro' | 'business';

export const BLUE_TEAMS_PLANS = {
  solo: {
    tier: 'solo', name: 'Solo', priceInr: 499, priceUsd: 5.27, days: 30, sku: 'blue_teams_solo_monthly',
    projectTeams: 1, agentsPerTeam: 3,
    features: ['Agent collaboration and task handoffs', 'Manual and event-triggered execution'],
    audience: 'For students, freelancers and solo developers.',
  },
  pro: {
    tier: 'pro', name: 'Pro', priceInr: 1499, priceUsd: 15.83, days: 30, sku: 'blue_teams_pro_monthly',
    projectTeams: 3, agentsPerTeam: 5,
    features: ['Automatic task coordination', 'Scheduled work and persistent responsibilities', 'Task history and approval controls'],
    audience: 'For startups, founders and professional freelancers.',
  },
  business: {
    tier: 'business', name: 'Business', priceInr: 4999, priceUsd: 52.78, days: 30, sku: 'blue_teams_business_monthly',
    projectTeams: 10, agentsPerTeam: 8,
    features: ['Shared access for employees', 'Multiple concurrent workflows', 'Project permissions, reporting and audit logs'],
    audience: 'For software companies, agencies and businesses.',
  },
} as const;

export const BLUE_TEAMS_TEST_PRICE_INR = 1;
export const BLUE_TEAMS_TEST_PRICE_USD = 0.01;
// The temporary production launch check applies only to Business.
export const BLUE_TEAMS_LIVE_TEST_TIER: BlueTeamsTier = 'business';
export const BLUE_TEAMS_BILLING_CYCLE = 'monthly' as const;

export function isBlueTeamsTier(value: unknown): value is BlueTeamsTier {
  return typeof value === 'string' && Object.hasOwn(BLUE_TEAMS_PLANS, value);
}

export function getBlueTeamsPlan(value: unknown) {
  return isBlueTeamsTier(value) ? BLUE_TEAMS_PLANS[value] : null;
}

export function getBlueTeamsTierFromCheckoutPlan(value: unknown): BlueTeamsTier | null {
  if (typeof value !== 'string' || !value.startsWith('blue_teams_')) return null;
  const tier = value.slice('blue_teams_'.length);
  return isBlueTeamsTier(tier) ? tier : null;
}

function validateRedeemedImr(redeemedImr: number): void {
  if (!Number.isFinite(redeemedImr) || redeemedImr < 0 || redeemedImr > 100) {
    throw new Error('Invalid IMR amount');
  }
}

/**
 * This intentionally follows the normal Blue checkout calculation: one IMR
 * reduces an INR charge by ₹0.50. The explicit sandbox Solo and temporary
 * live Business launch tests stay fixed ₹1 charges.
 */
export function getBlueTeamsPriceInr(tier: BlueTeamsTier, sandboxTestMode = false, redeemedImr = 0, liveTestMode = false): string {
  validateRedeemedImr(redeemedImr);
  const testPrice = (sandboxTestMode && tier === 'solo') || (liveTestMode && tier === BLUE_TEAMS_LIVE_TEST_TIER);
  const basePrice = testPrice ? BLUE_TEAMS_TEST_PRICE_INR : BLUE_TEAMS_PLANS[tier].priceInr;
  return Math.max(1, basePrice - (testPrice ? 0 : redeemedImr * 0.5)).toFixed(2);
}

/**
 * Keep USD checkout behaviour in lockstep with normal Blue checkout.
 * PayPal is USD-only, so its equivalent IMR reduction is $0.005 per IMR.
 */
export function getBlueTeamsPriceUsd(tier: BlueTeamsTier, sandboxTestMode = false, redeemedImr = 0, liveTestMode = false): string {
  validateRedeemedImr(redeemedImr);
  const testPrice = (sandboxTestMode && tier === 'solo') || (liveTestMode && tier === BLUE_TEAMS_LIVE_TEST_TIER);
  const basePrice = testPrice ? BLUE_TEAMS_TEST_PRICE_USD : BLUE_TEAMS_PLANS[tier].priceUsd;
  return Math.max(0.01, basePrice - (testPrice ? 0 : redeemedImr * 0.5 / 100)).toFixed(2);
}
