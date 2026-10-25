/** Runtime usage is passed through one-for-one. The 30% platform fee is collected at checkout. */
export const DEFAULT_BLUE_CREDIT_MULTIPLIER = 1;
export const BLUE_PLATFORM_FEE_PERCENT = 30;
export const BLUE_TEAMS_ACTIVATION_CREDITS = 25;

// Keep the exported function for installed callers, but an old environment
// variable must never charge a second platform fee during model usage.
export function configuredBlueCreditMultiplier(_value: unknown): number { return 1; }
