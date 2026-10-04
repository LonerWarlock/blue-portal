'use client';

import { useState, useEffect, useRef } from 'react';
import { CurrencySelector } from '@/app/components/CurrencySelector';
import { supabase } from '@/lib/supabase';
import { BLUE_SUBSCRIPTION_PLANS, bluePlanPriceInr, type BlueBillingCycle } from '@/lib/blueSubscriptionPlans';
import Link from 'next/link';

interface Props {
  sessionId: string;
  returnUrl: string;
  email: string;
  imrBalance: number;
  billingCycle: BlueBillingCycle;
}

const blueFeatures = [
  'AI Chat',
  'Code Autocomplete',
  'Codebase Search',
  'Syntax Checking',
  'Cloud Models',
  'Local Models',
  'Multi-Agent Teams',
  'Figma-to-Code',
  'GitHub Integration',
  'Vercel Integration',
  'Canva Integration',
  'Web Search',
];

interface PayPalButtons {
  render: (container: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
}

interface PayPalSdk {
  Buttons: (options: {
    style: { layout: 'vertical'; color: 'blue'; shape: 'rect'; label: 'paypal'; height: number };
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel: () => void;
    onError: (error: unknown) => void;
  }) => PayPalButtons;
}

let paypalSdkPromise: Promise<PayPalSdk> | null = null;

function loadPayPalSdk(): Promise<PayPalSdk> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  if (!clientId) {
    return Promise.reject(new Error('PayPal is currently unavailable. Please pay in INR or try again later.'));
  }

  const paypalWindow = window as Window & { paypal?: PayPalSdk };
  if (paypalWindow.paypal?.Buttons) return Promise.resolve(paypalWindow.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;

  paypalSdkPromise = new Promise<PayPalSdk>((resolve, reject) => {
    const script = document.createElement('script');
    const params = new URLSearchParams({ 'client-id': clientId, currency: 'USD', intent: 'capture', components: 'buttons' });
    script.src = `https://www.paypal.com/sdk/js?${params}`;
    script.async = true;

    const timeout = window.setTimeout(() => fail(), 20000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
    };
    const fail = () => {
      cleanup();
      script.remove();
      reject(new Error('Unable to load PayPal. Please try again or pay in INR.'));
    };
    script.onload = () => {
      if (!paypalWindow.paypal?.Buttons) {
        fail();
        return;
      }
      cleanup();
      resolve(paypalWindow.paypal);
    };
    script.onerror = fail;
    document.body.appendChild(script);
  }).catch(error => {
    paypalSdkPromise = null;
    throw error;
  });

  return paypalSdkPromise;
}

function paymentErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function closePayPalButtons(buttons: PayPalButtons | undefined) {
  try {
    if (buttons) void Promise.resolve(buttons.close()).catch(() => {});
  } catch {
    // A partially rendered SDK instance may already have closed itself.
  }
}

export function CheckoutForm({ sessionId, returnUrl, email, imrBalance, billingCycle }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redeemedImr, setRedeemedImr] = useState<number>(0);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [paypalStatus, setPaypalStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [paypalAttempt, setPaypalAttempt] = useState(0);
  const paypalContainerRef = useRef<HTMLDivElement>(null);

  const plan = BLUE_SUBSCRIPTION_PLANS[billingCycle];
  const basePrice = plan.priceInr;
  const discount = redeemedImr * 0.5;
  const finalPrice = bluePlanPriceInr(billingCycle, redeemedImr);

  useEffect(() => {
    if (currency !== 'USD' || !paypalContainerRef.current) return;

    let active = true;
    let buttons: PayPalButtons | undefined;
    let transactionId = '';
    let orderId = '';
    const requestController = new AbortController();
    // Each render owns its element, so a late SDK render cannot replace newer buttons.
    const container = document.createElement('div');
    paypalContainerRef.current.replaceChildren(container);
    setPaypalStatus('loading');
    setLoading(false);
    setError('');

    const renderPayPalButtons = async () => {
      try {
        const paypal = await loadPayPalSdk();
        if (!active) return;

        buttons = paypal.Buttons({
          style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal', height: 45 },
          createOrder: async () => {
            if (!active) throw new Error('Checkout has changed. Please try again.');
            setLoading(true);
            setError('');
            transactionId = '';
            orderId = '';
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Please sign in again before checking out.');
            if (!active) throw new Error('Checkout has changed. Please try again.');

            const res = await fetch('/api/checkout/paypal/create-order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ sessionId, returnUrl, redeemedImr: 0 }),
              signal: requestController.signal,
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to create PayPal order');
            if (!data.orderId || !data.txnid) throw new Error('Unable to start PayPal checkout. Please try again.');
            if (!active) throw new Error('Checkout has changed. Please try again.');
            transactionId = data.txnid;
            orderId = data.orderId;
            return orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            if (!active) return;
            if (!transactionId || data.orderID !== orderId) {
              setError('Unable to confirm this PayPal checkout. Please try again.');
              setLoading(false);
              return;
            }
            const params = new URLSearchParams({ session_id: sessionId, token: data.orderID, txnid: transactionId });
            window.location.href = `/api/checkout/paypal/capture?${params}`;
          },
          onCancel: () => {
            if (!active) return;
            transactionId = '';
            orderId = '';
            setLoading(false);
            setError('PayPal checkout was cancelled. You can try again.');
          },
          onError: (err: unknown) => {
            if (!active) return;
            setError(paymentErrorMessage(err, 'PayPal payment failed. Please try again.'));
            setLoading(false);
          },
        });
        await buttons.render(container);
        if (active) setPaypalStatus('ready');
      } catch (err) {
        if (!active) return;
        closePayPalButtons(buttons);
        buttons = undefined;
        container.replaceChildren();
        setPaypalStatus('failed');
        setError(paymentErrorMessage(err, 'Unable to load PayPal. Please try again or pay in INR.'));
        setLoading(false);
      }
    };

    void renderPayPalButtons();
    return () => {
      active = false;
      requestController.abort();
      container.remove();
      closePayPalButtons(buttons);
    };
  }, [billingCycle, currency, sessionId, returnUrl, paypalAttempt]);

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again before checking out.');
      const hashRes = await fetch('/api/checkout/payu/create-hash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sessionId, returnUrl, redeemedImr }),
      });

      const hashData = await hashRes.json();
      if (!hashRes.ok || hashData.error) {
        throw new Error(hashData.error || 'Failed to generate payment signature');
      }

      const form = document.createElement('form');
      form.action = hashData.payuUrl;
      form.method = 'POST';

      const params: Record<string, string> = {
        key: hashData.key,
        txnid: hashData.txnid,
        amount: hashData.amount,
        productinfo: hashData.productinfo,
        firstname: hashData.firstname,
        email: hashData.email,
        phone: '9999999999',
        surl: `${window.location.origin}/api/checkout/payu/callback`,
        furl: `${window.location.origin}/api/checkout/payu/callback`,
        hash: hashData.hash,
        service_provider: 'payu_paisa'
      };

      for (const [k, v] of Object.entries(params)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();

    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center">
      <section className="relative w-full flex items-center overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 relative z-10 w-full py-12">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              <span className="bg-brand bg-clip-text text-transparent">
                Complete Your Subscription
              </span>
            </h1>
            <p className="mt-2 text-ink-muted max-w-lg mx-auto">
              You are one step away from unlocking the full power of Blue AI.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-4xl mx-auto">
            <div className="lg:col-span-3">
              <div className="rounded-lg border border-line p-6 bg-paper-alt">
                <a
                  href={returnUrl}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink-muted transition-colors mb-4"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  Back to Console
                </a>
                <h2 className="text-base font-bold text-ink mb-4">Contact Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      tabIndex={-1}
                      className="w-full px-4 py-2.5 rounded-lg bg-paper-alt border border-line text-ink text-sm opacity-70 cursor-not-allowed"
                    />
                  </div>

                  <CurrencySelector value={currency} onChange={nextCurrency => {
                    setCurrency(nextCurrency);
                    setError('');
                    setLoading(false);
                    if (nextCurrency === 'USD') setRedeemedImr(0);
                  }} />

                  {currency === 'INR' && imrBalance > 0 && (
                    <div className="pt-3 border-t border-line">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider">Apply IMR Credits</h3>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand/10 border border-line text-brand">
                          Balance: {imrBalance.toFixed(0)} IMR
                        </span>
                      </div>
                      <div className="p-4 rounded-lg bg-brand/10 border border-line space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-ink-muted">Use IMR for this purchase:</span>
                          <span className="text-sm font-extrabold text-ink">{redeemedImr} IMR</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.min(100, imrBalance)}
                          value={redeemedImr}
                          onChange={(e) => setRedeemedImr(Number(e.target.value))}
                          className="w-full h-1.5 bg-paper-sunken rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-[10px] text-ink-faint font-semibold">
                          <span>0 IMR</span>
                          <span>Max IMR: {Math.min(100, imrBalance)}</span>
                        </div>
                        {redeemedImr > 0 && (
                          <p className="text-[10px] text-green-400 font-semibold flex items-center gap-1 animate-pulse">
                            <i className="fa-solid fa-tags"></i>
                            <span>You get -₹{(redeemedImr * 0.5).toFixed(2)} discount (1 IMR = ₹0.50)</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {currency === 'INR' && imrBalance === 0 && (
                    <div className="pt-3 border-t border-line">
                      <p className="text-[10px] text-ink-faint">No IMR balance available to redeem.</p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-line">
                    <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">Payment Method</h3>
                    {currency === 'INR' ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-paper-alt border border-line">
                        <div className="w-10 h-7 rounded-lg bg-brand/10 flex items-center justify-center text-brand text-xs font-bold">
                          <i className="fa-solid fa-credit-card"></i>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-ink">Pay securely with PayU</p>
                          <p className="text-[10px] text-ink-faint">Supports cards, Net Banking, UPI</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-paper-alt border border-line">
                        <div className="w-10 h-7 rounded-lg bg-yellow-900/40 flex items-center justify-center text-yellow-400 text-xs font-bold">
                          <i className="fa-brands fa-paypal"></i>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-ink">Pay securely with PayPal</p>
                          <p className="text-[10px] text-ink-faint">Cards, bank accounts, or PayPal balance</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/50 text-red-400 text-xs flex items-start gap-2">
                      <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                      <span>{error}</span>
                    </div>
                  )}

                  {currency === 'INR' ? (
                    <button
                      type="button"
                      onClick={handlePayment}
                      disabled={loading}
                      className="w-full px-6 py-3 rounded-lg bg-brand font-semibold text-white shadow-lg transition duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <i className="fa-solid fa-spinner animate-spin"></i>
                          Redirecting to PayU...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-lock"></i>
                          Pay ₹{finalPrice} — {plan.label} Access
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="min-h-[50px]">
                      {(paypalStatus === 'idle' || paypalStatus === 'loading') && (
                        <div className="w-full px-6 py-3 rounded-lg bg-paper-sunken flex items-center justify-center gap-2 text-sm text-ink-muted">
                          <i className="fa-solid fa-spinner animate-spin"></i>
                          Loading PayPal...
                        </div>
                      )}
                      <div id="paypal-button-container" ref={paypalContainerRef} />
                      {paypalStatus === 'failed' && (
                        <button type="button" onClick={() => setPaypalAttempt(attempt => attempt + 1)} className="w-full px-6 py-3 rounded-lg bg-paper-sunken text-sm text-ink-muted">
                          Try loading PayPal again
                        </button>
                      )}
                      {paypalStatus === 'ready' && loading && (
                        <p className="mt-2 text-xs text-ink-muted text-center">Completing your PayPal checkout...</p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-ink-muted text-center">
                    Your transaction is encrypted and secured by{' '}
                    <span className="text-brand font-semibold">
                      {currency === 'INR' ? 'PayU Payments' : 'PayPal'}
                    </span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-lg border border-line p-6 bg-paper-alt">
                <div className="flex items-start gap-3 pb-4 border-b border-line">
                  <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center shadow-lg shrink-0">
                    <i className="fa-solid fa-crown text-sm text-white"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-sm">Blue · {plan.label}</h3>
                    <p className="text-xs text-ink-faint">
                      {currency === 'INR' ? `₹${basePrice.toLocaleString('en-IN')} / ${plan.period}` : `$${plan.priceUsd.toFixed(2)} / ${plan.period}`} · {plan.days} days
                    </p>
                    <Link className="text-xs text-brand underline mt-1 inline-block" href={`/pricing?billing_cycle=${billingCycle}`}>Change duration</Link>
                  </div>
                </div>

                <div className="py-4 space-y-2 border-b border-line">
                  <p className="text-[10px] text-ink-faint font-semibold uppercase tracking-wider mb-2">Everything in Blue Lite, plus:</p>
                  {blueFeatures.slice(5).map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-xs text-ink-muted">
                      <span className="w-4 h-4 rounded-full bg-brand/10 border border-brand/30 text-brand flex items-center justify-center shrink-0 mt-0.5 text-[8px]">
                        <i className="fa-solid fa-check"></i>
                      </span>
                      {feature}
                    </div>
                  ))}
                </div>

                <div className="pt-4 space-y-2">
                  {currency === 'INR' ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-muted">Subtotal</span>
                        <span className="text-ink">₹{basePrice}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-xs text-brand font-semibold">
                          <span>IMR Discount Applied</span>
                          <span>-₹{discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-muted">Tax</span>
                        <span className="text-ink-faint">Included</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-line">
                        <span className="text-ink">Total</span>
                        <span className="bg-brand bg-clip-text text-transparent">₹{finalPrice}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-muted">Plan</span>
                        <span className="text-ink">Blue Subscription</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-muted">Billing</span>
                        <span className="text-ink">{plan.label} · {plan.days} days</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-muted">Tax</span>
                        <span className="text-ink-faint">Included</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-line">
                        <span className="text-ink">Total</span>
                        <span className="bg-brand bg-clip-text text-transparent">${plan.priceUsd.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-ink-muted">One upfront payment. No automatic renewal. If you already have active Blue access, these {plan.days} days are added to your remaining time.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
