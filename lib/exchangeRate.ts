import { configuredBlueCreditMultiplier } from '@/lib/blueCreditPolicy';
import { BLUE_CREDIT_PRICE_INR, BLUE_CREDIT_PRICE_USD, quoteBlueCredits, quoteBlueCreditsFromInr, type BlueCreditQuote } from '@/lib/blueCreditPricing';

export const APPROX_USD_TO_INR = 100;
export const PAYPAL_SUBSCRIPTION_PRICE_USD = 1.99;
export type BlueCreditPackId = 'starter' | 'standard' | 'custom';
export interface BlueCreditPack {
  id: BlueCreditPackId; name: string; description: string;
  /** Final customer prices. No separate checkout fee is added. */
  priceUSD: number; priceINR: number; credits: number;
  // Retained for clients consuming the existing catalogue shape.
  basePriceUSD: number; basePriceINR: number;
  platformFeeUSD: number; platformFeeINR: number; platformFeePercent: number;
  creditUnitPriceUSD: number; creditUnitPriceINR: number;
  accessTier: 'trial' | 'full'; multiplier: number;
}
function pack(id: BlueCreditPackId, quote: BlueCreditQuote, accessTier: 'trial' | 'full'): BlueCreditPack {
  return { id, name: id === 'custom' ? 'Blue Credits Custom' : id === 'standard' ? 'Blue Pro Full' : 'Blue Pro Starter',
    description: `${quote.credits} Blue Credits. Unused credits stay in your wallet.`,
    ...quote, basePriceUSD: quote.priceUSD, basePriceINR: quote.priceINR,
    platformFeeUSD: 0, platformFeeINR: 0, platformFeePercent: 0,
    creditUnitPriceUSD: BLUE_CREDIT_PRICE_USD, creditUnitPriceINR: BLUE_CREDIT_PRICE_INR,
    accessTier, multiplier: configuredBlueCreditMultiplier(undefined) };
}
export function getPackConfig(packId = 'starter'): BlueCreditPack {
  if (packId === 'custom') return getCustomPackConfig(25);
  if (packId === 'standard') return pack('standard', quoteBlueCredits(15), 'full');
  if (packId !== 'starter') throw new RangeError('Choose a valid Blue Credit pack.');
  return pack('starter', quoteBlueCredits(1), 'trial');
}
export function getPackCatalog(): BlueCreditPack[] { return [getPackConfig('starter'), getPackConfig('standard')]; }
export function getCustomPackConfig(credits: number): BlueCreditPack { return pack('custom', quoteBlueCredits(credits), 'full'); }
export function getCustomInrPackConfig(amount: number): BlueCreditPack { return pack('custom', quoteBlueCreditsFromInr(amount), 'full'); }
export function getCreditPurchasePack(input: { packId?: string; customCredits?: number; customInrAmount?: number }, allowInr: boolean): BlueCreditPack {
  if (input.customInrAmount !== undefined) {
    if (!allowInr || input.packId !== 'custom' || input.customCredits !== undefined) throw new RangeError('Choose either a credit quantity or an INR amount.');
    return getCustomInrPackConfig(input.customInrAmount);
  }
  return input.packId === 'custom' ? getCustomPackConfig(input.customCredits === undefined ? 25 : input.customCredits) : getPackConfig(input.packId);
}
