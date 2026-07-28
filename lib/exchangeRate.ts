export const APPROX_USD_TO_INR = 100;
export const PAYPAL_SUBSCRIPTION_PRICE_USD = 1.99;

export type BlueCreditPackId = 'starter' | 'standard' | 'custom';

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
  if (packId === 'custom') {
    return getCustomPackConfig(10);
  }
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

const CUSTOM_CREDIT_MIN = 10;
const CUSTOM_CREDIT_MAX = 100;
const CUSTOM_CREDIT_RATE_USD = 1;
const CUSTOM_CREDIT_RATE_INR = 100;

export function getCustomPackConfig(credits: number): BlueCreditPack {
  const clamped = Math.max(CUSTOM_CREDIT_MIN, Math.min(CUSTOM_CREDIT_MAX, Math.round(credits)));
  const multiplier = positiveNumber(process.env.BLUE_CREDIT_MULTIPLIER, 1.5);
  return {
    id: 'custom',
    name: 'Blue Pro Custom',
    description: `Choose exactly ${clamped} Blue Credits at the standard rate.`,
    priceUSD: clamped * CUSTOM_CREDIT_RATE_USD,
    priceINR: clamped * CUSTOM_CREDIT_RATE_INR,
    credits: clamped,
    accessTier: 'full',
    multiplier
  };
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
