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

export type BlueTeamsCheckoutQuote = {
  version: 1;
  mode: 'new' | 'renewal' | 'upgrade';
  from_plan?: BlueTeamsTier | null;
  quoted_at: string;
  effective_start: string;
  effective_end: string;
  base_amount_inr: string;
  base_amount_usd: string;
  currency_locked: 'INR' | 'USD' | null;
};

/** Only call with native database checkout metadata, never a request body. */
export function getBlueTeamsCheckoutQuote(metadata: unknown): BlueTeamsCheckoutQuote | null {
  const record = metadata && typeof metadata === 'object' ? metadata as Record<string,unknown> : {};
  const value = record.teams_quote;
  if (value === undefined || value === null) return null; // Legacy paid callbacks remain valid.
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Teams payment quote.');
  const q = value as Record<string,unknown>;
  if (q.version !== 1 || !['new','renewal','upgrade'].includes(String(q.mode))
    || ![null,undefined,'INR','USD'].includes(q.currency_locked as string | null | undefined)
    || !['base_amount_inr','base_amount_usd'].every(key => typeof q[key] === 'string' && /^\d{1,8}\.\d{2}$/.test(q[key] as string) && Number(q[key]) > 0)
    || !['quoted_at','effective_start','effective_end'].every(key => typeof q[key] === 'string' && Number.isFinite(Date.parse(q[key] as string)))
    || Date.parse(q.effective_end as string) <= Date.parse(q.effective_start as string)
    || Date.parse(q.effective_start as string) < Date.parse(q.quoted_at as string)
    || q.mode === 'upgrade' && !isBlueTeamsTier(q.from_plan)
    || q.from_plan !== undefined && q.from_plan !== null && !isBlueTeamsTier(q.from_plan)) {
    throw new Error('Invalid Teams payment quote.');
  }
  return {version:1,mode:q.mode as BlueTeamsCheckoutQuote['mode'],from_plan:q.from_plan as BlueTeamsTier | null | undefined,
    quoted_at:q.quoted_at as string,effective_start:q.effective_start as string,effective_end:q.effective_end as string,
    base_amount_inr:q.base_amount_inr as string,base_amount_usd:q.base_amount_usd as string,
    currency_locked:q.currency_locked as 'INR' | 'USD' | null || null};
}

/** Price a saved server quote, retaining legacy prices only for old checkouts. */
export function blueTeamsCheckoutAmount(tier: BlueTeamsTier, currency: 'INR' | 'USD', metadata: unknown, redeemedImr = 0): string {
  validateRedeemedImr(redeemedImr);
  const quote = getBlueTeamsCheckoutQuote(metadata);
  const record = metadata && typeof metadata === 'object' ? metadata as Record<string,unknown> : {};
  if (!quote) return currency === 'INR'
    ? getBlueTeamsPriceInr(tier,record.blue_teams_test_mode === true,redeemedImr,record.blue_teams_live_test_mode === true)
    : getBlueTeamsPriceUsd(tier,record.blue_teams_test_mode === true,redeemedImr,record.blue_teams_live_test_mode === true);
  if (quote.currency_locked && quote.currency_locked !== currency) throw new Error('Use the original payment currency for this upgrade.');
  if (quote.mode === 'upgrade' && redeemedImr !== 0) throw new Error('IMR credits cannot be combined with an upgrade adjustment.');
  const base = Number(currency === 'INR' ? quote.base_amount_inr : quote.base_amount_usd);
  const discount = currency === 'INR' ? redeemedImr * 0.5 : redeemedImr * 0.5 / 100;
  return Math.max(currency === 'INR' ? 1 : 0.01,base - discount).toFixed(2);
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
