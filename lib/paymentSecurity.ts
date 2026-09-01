import { createHash, timingSafeEqual } from 'crypto';

export type PayuCallbackData = Record<string, string>;

export type ExpectedPayuPayment = {
  key: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  txnid?: string;
};

export function payuRequestHash(input: ExpectedPayuPayment, salt: string): string {
  return createHash('sha512')
    .update(`${input.key}|${input.txnid || ''}|${input.amount}|${input.productinfo}|${input.firstname}|${input.email}|||||||||||${salt}`)
    .digest('hex');
}

export function payuCallbackHash(data: PayuCallbackData, salt: string): string {
  const base = `${salt}|${data.status || ''}|||||||||||${data.email || ''}|${data.firstname || ''}|${data.productinfo || ''}|${data.amount || ''}|${data.txnid || ''}|${data.key || ''}`;
  const source = data.additionalCharges ? `${data.additionalCharges}|${base}` : base;
  return createHash('sha512').update(source).digest('hex');
}

export function secureHexEquals(expected: string, received: string): boolean {
  if (!/^[a-f0-9]{128}$/i.test(expected) || !/^[a-f0-9]{128}$/i.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

export function validPayuCallbackSignature(data: PayuCallbackData, salt: string): boolean {
  if (!salt || !data.hash || !data.txnid) return false;
  return secureHexEquals(payuCallbackHash(data, salt), data.hash);
}

export function moneyEquals(actual: unknown, expected: unknown): boolean {
  const left = Number(actual);
  const right = Number(expected);
  return Number.isFinite(left) && Number.isFinite(right) && left.toFixed(2) === right.toFixed(2);
}

export function matchesExpectedPayuPayment(
  data: PayuCallbackData,
  expected: ExpectedPayuPayment
): boolean {
  return data.key === expected.key
    && data.txnid === (expected.txnid || data.txnid)
    && moneyEquals(data.amount, expected.amount)
    && data.productinfo === expected.productinfo
    && data.firstname === expected.firstname
    && data.email.trim().toLowerCase() === expected.email.trim().toLowerCase();
}

export function safeInternalUrl(value: unknown, siteUrl: string, fallbackPath: string): URL {
  const base = new URL(siteUrl);
  try {
    const candidate = new URL(typeof value === 'string' ? value : fallbackPath, base);
    if (candidate.origin === base.origin) return candidate;
  } catch {
    // Use the fixed fallback below.
  }
  return new URL(fallbackPath, base);
}

export function parsePayuForm(form: FormData): PayuCallbackData {
  const data: PayuCallbackData = {};
  form.forEach((value, key) => {
    data[key] = String(value).trim();
  });
  data.email = (data.email || '').toLowerCase();
  data.status = (data.status || '').toLowerCase();
  return data;
}
