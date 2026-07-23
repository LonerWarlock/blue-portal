'use client';

import { useState, useEffect } from 'react';
import { CurrencySelector } from '@/app/components/CurrencySelector';

interface Props {
  sessionId: string;
  userId: string;
  returnUrl: string;
  email: string;
  imrBalance: number;
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
  'Web Search',
];

const USD_PRICE = 1.99;

export function CheckoutForm({ sessionId, userId, returnUrl, email, imrBalance }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redeemedImr, setRedeemedImr] = useState<number>(0);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  const basePrice = 149;
  const discount = redeemedImr * 0.5;
  const finalPrice = Math.max(1, basePrice - discount);

  useEffect(() => {
    if (currency === 'USD' && !paypalLoaded) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=USD`;
      script.async = true;
      script.onload = () => setPaypalLoaded(true);
      script.onerror = () => console.error('Failed to load PayPal SDK');
      document.body.appendChild(script);
    }
  }, [currency, paypalLoaded]);

  useEffect(() => {
    if (currency === 'USD' && paypalLoaded && (window as any).paypal) {
      const container = document.getElementById('paypal-button-container');
      if (container) container.innerHTML = '';

      (window as any).paypal.Buttons({
        style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal', height: 45 },
        createOrder: async () => {
          const res = await fetch('/api/checkout/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, returnUrl, redeemedImr }),
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || 'Failed to create PayPal order');
          return data.orderId;
        },
        onApprove: async (data: { orderID: string }) => {
          window.location.href = `/api/checkout/paypal/capture?session_id=${sessionId}&token=${data.orderID}`;
        },
        onError: (err: any) => {
          setError(err.message || 'PayPal payment failed');
          setLoading(false);
        },
      }).render('#paypal-button-container');
    }
  }, [currency, paypalLoaded, sessionId, returnUrl, redeemedImr]);

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      const hashRes = await fetch('/api/checkout/payu/create-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="min-h-screen bg-[#030712] flex items-center">
      <section className="relative w-full flex items-center overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 relative z-10 w-full py-12">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Complete Your Subscription
              </span>
            </h1>
            <p className="mt-2 text-gray-400 max-w-lg mx-auto">
              You are one step away from unlocking the full power of Blue AI.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-4xl mx-auto">
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-gray-800/80 p-6 bg-gray-900/20 backdrop-blur-sm">
                <a
                  href={returnUrl}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-4"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  Back to Console
                </a>
                <h2 className="text-base font-bold text-gray-100 mb-4">Contact Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      tabIndex={-1}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-900/60 border border-gray-800 text-gray-100 text-sm opacity-70 cursor-not-allowed"
                    />
                  </div>

                  <CurrencySelector value={currency} onChange={setCurrency} />

                  {currency === 'INR' && imrBalance > 0 && (
                    <div className="pt-3 border-t border-gray-800/80">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Apply IMR Credits</h3>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-950/40 border border-purple-800/30 text-purple-400">
                          Balance: {imrBalance.toFixed(0)} IMR
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-900/30 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-300">Use IMR for this purchase:</span>
                          <span className="text-sm font-extrabold text-white">{redeemedImr} IMR</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.min(100, imrBalance)}
                          value={redeemedImr}
                          onChange={(e) => setRedeemedImr(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
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
                    <div className="pt-3 border-t border-gray-800/80">
                      <p className="text-[10px] text-gray-500">No IMR balance available to redeem.</p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-gray-800/80">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Payment Method</h3>
                    {currency === 'INR' ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/40 border border-gray-800/80">
                        <div className="w-10 h-7 rounded-lg bg-blue-900/40 flex items-center justify-center text-blue-400 text-xs font-bold">
                          <i className="fa-solid fa-credit-card"></i>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-200">Pay securely with PayU</p>
                          <p className="text-[10px] text-gray-500">Supports cards, Net Banking, UPI</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/40 border border-gray-800/80">
                        <div className="w-10 h-7 rounded-lg bg-yellow-900/40 flex items-center justify-center text-yellow-400 text-xs font-bold">
                          <i className="fa-brands fa-paypal"></i>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-200">Pay securely with PayPal</p>
                          <p className="text-[10px] text-gray-500">Cards, bank accounts, or PayPal balance</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-900/20 border border-red-800/50 text-red-400 text-xs flex items-start gap-2">
                      <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                      <span>{error}</span>
                    </div>
                  )}

                  {currency === 'INR' ? (
                    <button
                      type="button"
                      onClick={handlePayment}
                      disabled={loading}
                      className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <i className="fa-solid fa-spinner animate-spin"></i>
                          Redirecting to PayU...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-lock"></i>
                          Pay ₹{finalPrice.toFixed(0)} — Subscribe to Blue
                        </>
                      )}
                    </button>
                  ) : (
                    <div id="paypal-button-container" className="min-h-[50px]">
                      {!paypalLoaded && (
                        <div className="w-full px-6 py-3 rounded-xl bg-gray-800/50 flex items-center justify-center gap-2 text-sm text-gray-400">
                          <i className="fa-solid fa-spinner animate-spin"></i>
                          Loading PayPal...
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 text-center">
                    Your transaction is encrypted and secured by{' '}
                    <span className="text-blue-400 font-semibold">
                      {currency === 'INR' ? 'PayU Payments' : 'PayPal'}
                    </span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-gray-800/80 p-6 bg-gray-900/20 backdrop-blur-sm">
                <div className="flex items-start gap-3 pb-4 border-b border-gray-800/80">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shrink-0">
                    <i className="fa-solid fa-crown text-sm text-white"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-100 text-sm">Blue Plan</h3>
                    <p className="text-xs text-gray-500">
                      {currency === 'INR' ? `₹${basePrice}/month` : `$${USD_PRICE}/month`} — Cancel anytime
                    </p>
                  </div>
                </div>

                <div className="py-4 space-y-2 border-b border-gray-800/80">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Everything in Blue Lite, plus:</p>
                  {blueFeatures.slice(5).map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-xs text-gray-400">
                      <span className="w-4 h-4 rounded-full bg-blue-950/60 border border-blue-900/60 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 text-[8px]">
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
                        <span className="text-gray-400">Subtotal</span>
                        <span className="text-gray-200">₹{basePrice}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-xs text-indigo-400 font-semibold">
                          <span>IMR Discount Applied</span>
                          <span>-₹{discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Tax</span>
                        <span className="text-gray-500">Included</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-800/80">
                        <span className="text-gray-100">Total</span>
                        <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">₹{finalPrice.toFixed(0)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Plan</span>
                        <span className="text-gray-200">Blue Subscription</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Billing</span>
                        <span className="text-gray-200">Monthly</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Tax</span>
                        <span className="text-gray-500">Included</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-800/80">
                        <span className="text-gray-100">Total</span>
                        <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">${USD_PRICE.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
