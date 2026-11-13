/** Purchase prices are independent of the one-credit-per-USD usage ledger. */
export const BLUE_CREDIT_PRICE_INR = 115;
// Preserve the existing international checkout total as a flat unit price.
export const BLUE_CREDIT_PRICE_USD = 1.3;
export const MAX_CUSTOM_BLUE_CREDITS = 100;
export const BLUE_CREDIT_PRICING_VERSION = 'blue-credit-flat-inr115-v2';
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const roundCredits = (value: number) => Number(value.toFixed(10));
export type BlueCreditQuote = { credits: number; priceINR: number; priceUSD: number };
export function quoteBlueCredits(credits: number): BlueCreditQuote {
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > MAX_CUSTOM_BLUE_CREDITS) {
    throw new RangeError('Choose 1 to 100 whole Blue Credits.');
  }
  return { credits, priceINR: roundMoney(credits * BLUE_CREDIT_PRICE_INR), priceUSD: roundMoney(credits * BLUE_CREDIT_PRICE_USD) };
}
export function quoteBlueCreditsFromInr(amount: number): BlueCreditQuote {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1
    || amount > MAX_CUSTOM_BLUE_CREDITS * BLUE_CREDIT_PRICE_INR || Math.abs(roundMoney(amount) - amount) > 1e-8) {
    throw new RangeError('Enter an INR amount from ₹1 to ₹11,500, with up to two decimal places.');
  }
  const priceINR = roundMoney(amount);
  // Match Postgres numeric(18,10); do not round the purchase down to whole credits.
  const credits = roundCredits(priceINR / BLUE_CREDIT_PRICE_INR);
  return { credits, priceINR, priceUSD: roundMoney(credits * BLUE_CREDIT_PRICE_USD) };
}
