export interface CreditPackDisplay {
  id: 'starter' | 'standard' | 'custom'; name: string; description: string; credits: number;
  priceINR: number; priceUSD: number; basePriceINR: number; basePriceUSD: number;
  platformFeeINR: number; platformFeeUSD: number; platformFeePercent: number;
}
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function validCreditPackDisplay(value: unknown): value is CreditPackDisplay {
  if (!value || typeof value !== 'object') return false;
  const pack = value as CreditPackDisplay;
  if (!['starter', 'standard', 'custom'].includes(pack.id) || typeof pack.name !== 'string' || typeof pack.description !== 'string'
    || !Number.isInteger(pack.credits) || pack.credits < 1 || pack.platformFeePercent !== 30) return false;
  if (!['priceINR','priceUSD','basePriceINR','basePriceUSD','platformFeeINR','platformFeeUSD'].every(key => typeof pack[key as keyof CreditPackDisplay] === 'number' && Number.isFinite(pack[key as keyof CreditPackDisplay]) && Number(pack[key as keyof CreditPackDisplay]) >= 0)) return false;
  return pack.basePriceUSD === pack.credits && pack.priceUSD === money(pack.basePriceUSD + pack.platformFeeUSD)
    && pack.priceINR === money(pack.basePriceINR + pack.platformFeeINR)
    && pack.platformFeeUSD === money(pack.basePriceUSD * .3) && pack.platformFeeINR === money(pack.basePriceINR * .3);
}
export function customCreditPackDisplay(reference: CreditPackDisplay | undefined, credits: number): CreditPackDisplay | null {
  if (!reference || !validCreditPackDisplay(reference) || !Number.isInteger(credits) || credits < 10 || credits > 100) return null;
  const basePriceUSD = credits, basePriceINR = money(reference.basePriceINR / reference.credits * credits);
  const platformFeeUSD = money(basePriceUSD * .3), platformFeeINR = money(basePriceINR * .3);
  return { id: 'custom', name: 'Blue Credits Custom', description: 'Choose your credit amount. Unused credits stay in your wallet.', credits,
    basePriceUSD, basePriceINR, platformFeeUSD, platformFeeINR, platformFeePercent: 30,
    priceUSD: money(basePriceUSD + platformFeeUSD), priceINR: money(basePriceINR + platformFeeINR) };
}
export function initialCreditCheckoutSelection(search: string): { packId: CreditPackDisplay['id']; customCredits: number } {
  const params = new URLSearchParams(search), requested = params.get('pack'), amount = Number(params.get('credits'));
  const customCredits = Number.isInteger(amount) && amount >= 10 && amount <= 100 ? amount : 25;
  return { packId: requested === 'custom' || requested === 'standard' ? requested : 'starter', customCredits };
}
