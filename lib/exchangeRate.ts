const FALLBACK_INR_RATE = 83;
let cachedRate: number | null = null;
let cacheTime = 0;
const CACHE_TTL = 3600000;

export async function getUsdToInr(): Promise<number> {
  if (cachedRate && Date.now() - cacheTime < CACHE_TTL) {
    return cachedRate;
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = Number(data.rates?.INR);
    if (!rate || rate <= 0) throw new Error('Invalid rate');
    cachedRate = rate;
    cacheTime = Date.now();
    return rate;
  } catch (err) {
    console.warn('Exchange rate fetch failed, using fallback:', err);
    return FALLBACK_INR_RATE;
  }
}

export function getPackConfig() {
  return {
    priceUSD: parseFloat(process.env.BLUE_CREDIT_PACK_PRICE_USD || '15'),
    credits: parseFloat(process.env.BLUE_CREDIT_PACK_CREDITS || '15'),
    multiplier: parseFloat(process.env.BLUE_CREDIT_MULTIPLIER || '1.5'),
  };
}
