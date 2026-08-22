const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
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
  });

  if (!res.ok) throw new Error('Failed to authenticate with PayPal');
  const data = await res.json();
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
    },
    body: JSON.stringify(body),
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
}

export async function capturePaypalOrder(orderId: string): Promise<PayPalCaptureResult> {
  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to capture PayPal order');
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    orderId: data.id,
    status: data.status,
    payerEmail: data.payer?.email_address,
    payerId: data.payer?.payer_id,
    captureId: capture?.id,
    grossAmount: capture?.amount?.value,
    currency: capture?.amount?.currency_code,
  };
}
