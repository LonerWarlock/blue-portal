import { configuredBlueCreditMultiplier, BLUE_PLATFORM_FEE_PERCENT } from '@/lib/blueCreditPolicy';

export const APPROX_USD_TO_INR = 100;
export const PAYPAL_SUBSCRIPTION_PRICE_USD = 1.99;
export type BlueCreditPackId = 'starter' | 'standard' | 'custom';
export interface BlueCreditPack {
  id: BlueCreditPackId; name: string; description: string;
  /** Total charged, including the platform fee. */
  priceUSD: number; priceINR: number; credits: number;
  basePriceUSD: number; basePriceINR: number;
  platformFeeUSD: number; platformFeeINR: number; platformFeePercent: number;
  creditUnitPriceUSD: number; creditUnitPriceINR: number;
  accessTier: 'trial' | 'full'; multiplier: number;
}
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
function pack(id: BlueCreditPackId, credits: number, accessTier: 'trial' | 'full'): BlueCreditPack {
  const basePriceUSD = money(credits), basePriceINR = money(credits * APPROX_USD_TO_INR);
  const platformFeeUSD = money(basePriceUSD * BLUE_PLATFORM_FEE_PERCENT / 100);
  const platformFeeINR = money(basePriceINR * BLUE_PLATFORM_FEE_PERCENT / 100);
  return { id, name: id === 'custom' ? 'Blue Pro Custom' : id === 'standard' ? 'Blue Pro Full' : 'Blue Pro Starter',
    description: `${credits} Blue Credits, with a separately charged 30% platform fee.`,
    priceUSD: money(basePriceUSD + platformFeeUSD), priceINR: money(basePriceINR + platformFeeINR),
    basePriceUSD, basePriceINR, platformFeeUSD, platformFeeINR,
    platformFeePercent: BLUE_PLATFORM_FEE_PERCENT, creditUnitPriceUSD: 1,
    creditUnitPriceINR: APPROX_USD_TO_INR, credits, accessTier,
    multiplier: configuredBlueCreditMultiplier(undefined) };
}
export function getPackConfig(packId = 'starter'): BlueCreditPack {
  if (packId === 'custom') return getCustomPackConfig(25);
  if (packId === 'standard') return pack('standard', 15, 'full');
  if (packId !== 'starter') throw new RangeError('Choose a valid Blue Credit pack.');
  return pack('starter', 1, 'trial');
}
export function getPackCatalog(): BlueCreditPack[] { return [getPackConfig('starter'), getPackConfig('standard')]; }
export function getCustomPackConfig(credits: number): BlueCreditPack {
  if (!Number.isSafeInteger(credits) || credits < 10 || credits > 100) throw new RangeError('Choose 10 to 100 whole Blue Credits.');
  return pack('custom', credits, 'full');
}
