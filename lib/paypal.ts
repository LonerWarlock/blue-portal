const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PayPal credentials not configured');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error('Failed to authenticate with PayPal');
  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('PayPal did not return an access token');
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 300)) * 1000,
  };
  return data.access_token;
}

export interface PayPalCreateOrderParams {
  amount: string;
  currency?: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  customId?: string;
  invoiceId?: string;
}

export interface PayPalOrderResult {
  orderId: string;
  approveUrl: string;
}

export async function createPaypalOrder(params: PayPalCreateOrderParams): Promise<PayPalOrderResult> {
  const token = await getAccessToken();

  const body = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: params.currency || 'USD',
        value: params.amount,
      },
      description: params.description,
      custom_id: params.customId,
      invoice_id: params.invoiceId,
    }],
    application_context: {
      brand_name: 'Blue Portal',
      locale: 'en-US',
      landing_page: 'BILLING',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
    },
  };

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': params.invoiceId || `create-${Date.now()}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.message || 'Failed to create PayPal order');
  }

  const approveUrl = data.links?.find((l: { rel: string }) => l.rel === 'approve')?.href;
  if (!approveUrl) throw new Error('No approve URL returned from PayPal');

  return { orderId: data.id, approveUrl };
}

export interface PayPalCaptureResult {
  orderId: string;
  status: string;
  payerEmail?: string;
  payerId?: string;
  captureId?: string;
  grossAmount?: string;
  currency?: string;
  customId?: string;
  invoiceId?: string;
}

export async function capturePaypalOrder(orderId: string): Promise<PayPalCaptureResult> {
  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-${orderId}`,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to capture PayPal order');
  }

  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  return {
    orderId: data.id,
    status: data.status,
    payerEmail: data.payer?.email_address,
    payerId: data.payer?.payer_id,
    captureId: capture?.id,
    grossAmount: capture?.amount?.value,
    currency: capture?.amount?.currency_code,
    customId: purchaseUnit?.custom_id,
    invoiceId: purchaseUnit?.invoice_id,
  };
}
