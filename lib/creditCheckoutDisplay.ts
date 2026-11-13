import { quoteBlueCredits, quoteBlueCreditsFromInr, BLUE_CREDIT_PRICE_INR, BLUE_CREDIT_PRICE_USD, roundMoney, type BlueCreditQuote } from '@/lib/blueCreditPricing';
export interface CreditPackDisplay {
  id: 'starter' | 'standard' | 'custom'; name: string; description: string; credits: number;
  priceINR: number; priceUSD: number; basePriceINR: number; basePriceUSD: number;
  platformFeeINR: number; platformFeeUSD: number; platformFeePercent: number;
}
export function validCreditPackDisplay(value: unknown): value is CreditPackDisplay {
  if (!value || typeof value !== 'object') return false;
  const pack = value as CreditPackDisplay;
  if (!['starter', 'standard', 'custom'].includes(pack.id) || typeof pack.name !== 'string' || typeof pack.description !== 'string'
    || typeof pack.credits !== 'number' || !Number.isFinite(pack.credits) || pack.credits <= 0 || pack.credits > 100) return false;
  return pack.platformFeePercent === 0 && pack.platformFeeUSD === 0 && pack.platformFeeINR === 0
    && pack.basePriceUSD === pack.priceUSD && pack.basePriceINR === pack.priceINR
    && pack.priceUSD === roundMoney(pack.credits * BLUE_CREDIT_PRICE_USD)
    && pack.priceINR === roundMoney(pack.credits * BLUE_CREDIT_PRICE_INR);
}
function displayQuote(reference: CreditPackDisplay | undefined, quote: () => BlueCreditQuote): CreditPackDisplay | null {
  if (!reference || !validCreditPackDisplay(reference)) return null;
  try {
    const result = quote();
    return { id: 'custom', name: 'Blue Credits Custom', description: 'Choose your amount. Unused credits stay in your wallet.', ...result,
      basePriceUSD: result.priceUSD, basePriceINR: result.priceINR, platformFeeUSD: 0, platformFeeINR: 0, platformFeePercent: 0 };
  } catch { return null; }
}
export function customCreditPackDisplay(reference: CreditPackDisplay | undefined, credits: number): CreditPackDisplay | null {
  return displayQuote(reference, () => quoteBlueCredits(credits));
}
export function customInrPackDisplay(reference: CreditPackDisplay | undefined, amount: number): CreditPackDisplay | null {
  return displayQuote(reference, () => quoteBlueCreditsFromInr(amount));
}
export function initialCreditCheckoutSelection(search: string): { packId: CreditPackDisplay['id']; customCredits: number } {
  const params = new URLSearchParams(search), requested = params.get('pack'), amount = Number(params.get('credits'));
  const customCredits = Number.isInteger(amount) && amount >= 1 && amount <= 100 ? amount : 25;
  return { packId: requested === 'custom' || requested === 'standard' ? requested : 'starter', customCredits };
}
