export type BlueBillingCycle = 'monthly' | 'quarterly' | 'yearly';

/** Shared display catalogue. Payment routes independently select from this allowlist. */
export const BLUE_SUBSCRIPTION_PLANS = {
  monthly: { label: 'Monthly', priceInr: 149, days: 30, months: 1, sku: 'blue_monthly', period: 'month' },
  quarterly: { label: 'Quarterly', priceInr: 399, days: 90, months: 3, sku: 'blue_quarterly', period: 'quarter' },
  yearly: { label: 'Yearly', priceInr: 1299, days: 365, months: 12, sku: 'blue_yearly', period: 'year' },
} as const;

export function isBlueBillingCycle(value: unknown): value is BlueBillingCycle {
  return typeof value === 'string' && Object.hasOwn(BLUE_SUBSCRIPTION_PLANS, value);
}

export function getBlueSubscriptionPlan(value: unknown) {
  return isBlueBillingCycle(value) ? BLUE_SUBSCRIPTION_PLANS[value] : null;
}

export function bluePlanSavings(cycle: BlueBillingCycle): number {
  const plan = BLUE_SUBSCRIPTION_PLANS[cycle];
  return Math.round((1 - plan.priceInr / (BLUE_SUBSCRIPTION_PLANS.monthly.priceInr * plan.months)) * 100);
}

export function bluePlanPriceInr(cycle: BlueBillingCycle, redeemedImr = 0): string {
  if (!Number.isFinite(redeemedImr) || redeemedImr < 0 || redeemedImr > 100) {
    throw new Error('Invalid IMR amount');
  }
  return Math.max(1, BLUE_SUBSCRIPTION_PLANS[cycle].priceInr - redeemedImr * 0.5).toFixed(2);
}
