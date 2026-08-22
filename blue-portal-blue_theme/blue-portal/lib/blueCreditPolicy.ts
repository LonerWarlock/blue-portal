export const DEFAULT_BLUE_CREDIT_MULTIPLIER = 1.5;

export function configuredBlueCreditMultiplier(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1
    ? parsed
    : DEFAULT_BLUE_CREDIT_MULTIPLIER;
}
