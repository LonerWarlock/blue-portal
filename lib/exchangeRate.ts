export const APPROX_USD_TO_INR = 96;
export const PAYPAL_SUBSCRIPTION_PRICE_USD = 1.99;

export type BlueCreditPackId = 'starter' | 'standard';

export interface BlueCreditPack {
  id: BlueCreditPackId;
  name: string;
  description: string;
  priceUSD: number;
  priceINR: number;
  credits: number;
  accessTier: 'trial' | 'full';
  multiplier: number;
}

export function getPackConfig(packId: string = 'starter'): BlueCreditPack {
  const multiplier = positiveNumber(process.env.BLUE_CREDIT_MULTIPLIER, 1.5);
  if (packId === 'standard') {
    const priceUSD = positiveNumber(process.env.BLUE_STANDARD_PACK_PRICE_USD, 15);
    return {
      id: 'standard',
      name: 'Blue Pro Full',
      description: 'Full paid-model catalog with renewable Blue Credits.',
      priceUSD,
      priceINR: Math.round(priceUSD * APPROX_USD_TO_INR),
      credits: positiveNumber(process.env.BLUE_STANDARD_PACK_CREDITS, 15),
      accessTier: 'full',
      multiplier
    };
  }

  const priceUSD = positiveNumber(process.env.BLUE_STARTER_PACK_PRICE_USD, 1);
  return {
    id: 'starter',
    name: 'Blue Pro Starter',
    description: 'A renewable paid trial with selected cost-efficient models and no expiry.',
    priceUSD,
    priceINR: Math.round(priceUSD * APPROX_USD_TO_INR),
    credits: positiveNumber(process.env.BLUE_STARTER_PACK_CREDITS, 1),
    accessTier: 'trial',
    multiplier
  };
}

export function getPackCatalog(): BlueCreditPack[] {
  return [getPackConfig('starter'), getPackConfig('standard')];
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
