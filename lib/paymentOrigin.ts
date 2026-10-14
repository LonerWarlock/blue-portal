// Production payment callbacks must not inherit the retired NEXT_PUBLIC_SITE_URL.
// Do not trust an arbitrary request Host as a destination for money callbacks.
export const PAYMENT_SITE_ORIGIN = 'https://blue.imergene.in';

export function paymentSiteOrigin(requestUrl?: string): string {
  try {
    const url = new URL(requestUrl || '');
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && ['http:', 'https:'].includes(url.protocol)) return url.origin;
  } catch { /* Use the verified production origin. */ }
  return PAYMENT_SITE_ORIGIN;
}
