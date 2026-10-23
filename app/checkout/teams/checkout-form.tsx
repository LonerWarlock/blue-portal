'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CurrencySelector } from '@/app/components/CurrencySelector';
import { useAuth } from '@/app/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { BLUE_TEAMS_PLANS, blueTeamsCheckoutAmount, type BlueTeamsCheckoutQuote, type BlueTeamsTier } from '@/lib/blueTeamsPlans';

interface Props {
  sessionId: string; returnUrl: string; email: string; tier: BlueTeamsTier; sandboxTestMode: boolean; liveTestMode: boolean;
  imrBalance: number;
  quote: BlueTeamsCheckoutQuote | null;
}
interface PayPalButtons { render: (container: HTMLElement) => Promise<void>; close: () => Promise<void> }
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
  if (!clientId) return Promise.reject(new Error('PayPal is currently unavailable. Please choose PayU.'));
  const paypalWindow = window as Window & { paypal?: PayPalSdk };
  if (paypalWindow.paypal?.Buttons) return Promise.resolve(paypalWindow.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise<PayPalSdk>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?${new URLSearchParams({ 'client-id': clientId, currency: 'USD', intent: 'capture', components: 'buttons' })}`;
    script.async = true;
    const timeout = window.setTimeout(() => fail(), 20000);
    const cleanup = () => { window.clearTimeout(timeout); script.onload = null; script.onerror = null; };
    const fail = () => { cleanup(); script.remove(); reject(new Error('Unable to load PayPal. Please try again or choose PayU.')); };
    script.onload = () => {
      if (!paypalWindow.paypal?.Buttons) return fail();
      cleanup(); resolve(paypalWindow.paypal);
    };
    script.onerror = fail;
    document.body.appendChild(script);
  }).catch(error => { paypalSdkPromise = null; throw error; });
  return paypalSdkPromise;
}

function closeButtons(buttons: PayPalButtons | undefined) {
  try { if (buttons) void Promise.resolve(buttons.close()).catch(() => {}); } catch { /* SDK instance already closed. */ }
}

export default function TeamsCheckoutForm({ sessionId, returnUrl, email, tier, sandboxTestMode, liveTestMode, imrBalance, quote }: Props) {
  const auth = useAuth();
  const plan = BLUE_TEAMS_PLANS[tier];
  const testPrice = sandboxTestMode || liveTestMode;
  const selectionScope = JSON.stringify([sessionId, returnUrl, tier, sandboxTestMode, liveTestMode, quote, auth.user?.id || null]);
  const [selection, setSelection] = useState<{ scope: string; currency: 'INR' | 'USD'; redeemedImr: number }>(() => ({ scope: selectionScope, currency: 'INR', redeemedImr: 0 }));
  // A saved quote's currency is authoritative on every render, including a
  // client-side move to another checkout before reset effects have run.
  const currency = quote?.currency_locked || (selection.scope === selectionScope ? selection.currency : 'INR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalStatus, setPaypalStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [paypalAttempt, setPaypalAttempt] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const upgrade = quote?.mode === 'upgrade';
  const redeemedImr = selection.scope === selectionScope && currency === 'INR' && !upgrade && !testPrice
    ? Math.min(100, Math.max(0, imrBalance), selection.redeemedImr) : 0;
  const contextKey = JSON.stringify([selectionScope, currency, redeemedImr, auth.loading]);
  const currentContext = useRef(contextKey); currentContext.current = contextKey;
  const payuRequest = useRef<{ key: string; controller: AbortController } | undefined>(undefined);
  const priceMetadata = {teams_quote:quote,blue_teams_test_mode:sandboxTestMode,blue_teams_live_test_mode:liveTestMode};
  // The unused amount in the other currency is never used for a locked upgrade.
  const amountInr = quote?.currency_locked === 'USD' ? '0.00' : blueTeamsCheckoutAmount(tier,'INR',priceMetadata,redeemedImr);
  const amountUsd = quote?.currency_locked === 'INR' ? '0.00' : blueTeamsCheckoutAmount(tier,'USD',priceMetadata,0);
  const baseAmountInr = quote?.base_amount_inr || amountInr;
  const imrDiscount = testPrice ? 0 : redeemedImr * 0.5;

  useEffect(() => {
    setLoading(false); setError('');
    return () => {
      // A canceled fetch cannot prevent a provider already contacted from
      // processing its order, but its late response must never submit a form
      // or navigate under a different account/session/currency.
      const request = payuRequest.current;
      if (request?.key === contextKey) { request.controller.abort(); payuRequest.current = undefined; }
    };
  }, [contextKey]);

  useEffect(() => {
    if (auth.loading || auth.user) return;
    let active = true;
    // A checkout session is still bound to its original user by the API. This
    // redirect merely gives a signed-out visitor a clear route back to it.
    void supabase.auth.getSession().then((result: { data: { session: unknown | null } }) => {
      const session = result.data.session;
      if (!active || session || auth.user) return;
      sessionStorage.setItem('redirectAfterLogin', `${window.location.pathname}${window.location.search}`);
      window.location.assign('/console');
    }).catch(() => { if (active) setError('Your sign-in could not be checked. Return to Teams and sign in again.'); });
    return () => { active = false; };
  }, [auth.loading, auth.user?.id, sessionId]);

  useEffect(() => {
    if (auth.loading || !auth.user?.id || currency !== 'USD' || !containerRef.current) return;
    const owner = auth.user.id;
    let active = true;
    let buttons: PayPalButtons | undefined;
    let txnid = '';
    let orderId = '';
    const controller = new AbortController();
    const current = () => active && !controller.signal.aborted && currentContext.current === contextKey;
    const container = document.createElement('div');
    containerRef.current.replaceChildren(container);
    setPaypalStatus('loading'); setLoading(false); setError('');

    const render = async () => {
      try {
        const paypal = await loadPayPalSdk();
        if (!current()) return;
        buttons = paypal.Buttons({
          style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal', height: 45 },
          createOrder: async () => {
            if (!current()) throw new Error('Checkout changed. Please try again.');
            setLoading(true); setError(''); txnid = ''; orderId = '';
            const { data: { session } } = await supabase.auth.getSession();
            if (!current()) throw new Error('Checkout changed. Please try again.');
            if (!session?.access_token || session.user?.id !== owner) throw new Error('Please sign in again before checking out.');
            const response = await fetch('/api/teams/checkout/paypal/create-order', {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              // Match the Pricing flow: IMR is only redeemable against INR.
              body: JSON.stringify({ sessionId, returnUrl, redeemedImr: 0 }), signal: controller.signal,
            });
            const data = await response.json();
            if (!current()) throw new Error('Checkout changed. Please try again.');
            if (!response.ok || !data.orderId || !data.txnid) throw new Error(data.error || 'Could not start PayPal checkout.');
            txnid = data.txnid; orderId = data.orderId;
            return orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            if (!current()) return;
            if (!txnid || data.orderID !== orderId) { setError('Could not confirm this PayPal order. Please restart checkout.'); setLoading(false); return; }
            // Auth SDK state can change before React receives its notification.
            // Verify the same account again before leaving for capture.
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!current()) return;
              if (!session?.access_token || session.user?.id !== owner) {
                setError('Please sign in to the original checkout account before completing this payment.'); setLoading(false); return;
              }
            } catch {
              if (current()) { setError('Your sign-in could not be verified. Please sign in again before completing checkout.'); setLoading(false); }
              return;
            }
            const query = new URLSearchParams({ session_id: sessionId, token: data.orderID, txnid });
            window.location.href = `/api/teams/checkout/paypal/capture?${query}`;
          },
          onCancel: () => { if (current()) { setLoading(false); setError('PayPal checkout was cancelled. If you already approved a payment, check Console before trying again.'); } },
          onError: cause => { if (current()) { setLoading(false); setError(cause instanceof Error ? cause.message : 'PayPal payment failed. Please try again.'); } },
        });
        await buttons.render(container);
        if (current()) setPaypalStatus('ready');
      } catch (cause) {
        if (!current()) return;
        closeButtons(buttons); buttons = undefined; container.replaceChildren(); setPaypalStatus('failed'); setLoading(false);
        setError(cause instanceof Error ? cause.message : 'Unable to load PayPal.');
      }
    };
    void render();
    return () => { active = false; controller.abort(); container.remove(); closeButtons(buttons); };
  }, [contextKey, paypalAttempt]);

  const payWithPayU = async () => {
    if (auth.loading || !auth.user?.id || currency !== 'INR' || payuRequest.current) return;
    const owner = auth.user.id;
    const request = { key: contextKey, controller: new AbortController() };
    payuRequest.current = request;
    const current = () => payuRequest.current === request && !request.controller.signal.aborted && currentContext.current === request.key;
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!current()) return;
      if (!session?.access_token || session.user?.id !== owner) throw new Error('Please sign in again before checking out.');
      const response = await fetch('/api/teams/checkout/payu/create-hash', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, returnUrl, redeemedImr }), signal: request.controller.signal,
      });
      const data = await response.json();
      if (!current()) return;
      if (!response.ok || data.error) throw new Error(data.error || 'Could not initialize PayU.');
      const form = document.createElement('form'); form.action = data.payuUrl; form.method = 'POST';
      const values: Record<string, string> = {
        key: data.key, txnid: data.txnid, amount: data.amount, productinfo: data.productinfo,
        firstname: data.firstname, email: data.email, phone: '9999999999',
        surl: `${window.location.origin}/api/teams/checkout/payu/callback`,
        furl: `${window.location.origin}/api/teams/checkout/payu/callback`,
        hash: data.hash, service_provider: 'payu_paisa',
      };
      for (const [name, value] of Object.entries(values)) {
        const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input);
      }
      document.body.appendChild(form); form.submit();
    } catch (cause) {
      if (!current()) return;
      payuRequest.current = undefined;
      setError(cause instanceof Error ? cause.message : 'Could not initialize PayU. Please try again.'); setLoading(false);
    }
  };

  const currencyInr = currency === 'INR';
  const displayed = currencyInr ? `₹${amountInr}` : `$${amountUsd}`;
  if (auth.loading || !auth.user) {
    return <main className="min-h-screen bg-paper flex items-center justify-center p-6"><section className="max-w-md rounded-xl border border-line bg-paper-alt p-8 text-center">
      <h1 className="text-lg font-bold text-ink">Checking your sign-in</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">If needed, we’ll take you to sign in and resume this selected Blue Teams checkout afterwards.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error} <Link href="/teams" className="underline">Return to Teams</Link></p>}
    </section></main>;
  }
  return <main className="min-h-screen bg-paper flex items-center py-10">
    <section className="w-full px-5">
      <div className="max-w-4xl mx-auto mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-ink">Complete your Blue Teams checkout</h1>
        <p className="mt-2 max-w-xl mx-auto text-sm leading-6 text-ink-muted">{upgrade ? 'Prorated upgrade for the remainder of your current period. Your expiry date stays the same.' : 'One prepaid 30-day period.'} No auto-renewal and no recurring charge.</p>
        {sandboxTestMode && <p role="status" className="mt-3 text-xs text-amber-600 dark:text-amber-300">Sandbox test: Solo’s ₹1 / $0.01 price is only available through test payment gateways. No real payment will be collected.</p>}
        {liveTestMode && <p role="status" className="mt-3 text-xs text-amber-600 dark:text-amber-300">Temporary live launch test: Business is ₹1 / $0.01. It uses the real payment gateway and activates a live Blue Teams entitlement.</p>}
      </div>
      <div className="grid max-w-4xl mx-auto grid-cols-1 gap-5 lg:grid-cols-5">
        <section className="lg:col-span-3 rounded-xl border border-line p-6 bg-paper-alt">
          <Link href={returnUrl} className="inline-flex min-h-10 items-center text-xs text-ink-faint hover:text-brand">← Back to Blue Teams</Link>
          <h2 className="mt-3 text-base font-bold text-ink">Payment details</h2>
          <label className="mt-4 block text-xs font-medium text-ink-muted">Account email</label>
          <input type="email" value={email} readOnly aria-label="Account email" className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink opacity-75" />
          <div className="mt-5">{quote?.currency_locked ? <p className="text-sm text-ink-muted">Upgrade currency: {quote.currency_locked}. Use the original payment currency so the paid adjustment remains accurate.</p> : <CurrencySelector value={currency} onChange={next => {
            setSelection(current => ({ scope: selectionScope, currency: next, redeemedImr: next === 'INR' && current.scope === selectionScope ? current.redeemedImr : 0 })); setError(''); setLoading(false);
          }} />}</div>
          {currencyInr && !testPrice && !upgrade && imrBalance > 0 && <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Apply IMR Credits</h3>
              <span className="rounded border border-line bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">Balance: {imrBalance.toFixed(0)} IMR</span>
            </div>
            <div className="space-y-3 rounded-lg border border-line bg-brand/10 p-4">
              <div className="flex items-center justify-between"><span className="text-xs text-ink-muted">Use IMR for this purchase:</span><span className="text-sm font-extrabold text-ink">{redeemedImr} IMR</span></div>
              <input type="range" min="0" max={Math.min(100, imrBalance)} value={redeemedImr}
                onChange={event => setSelection({ scope: selectionScope, currency, redeemedImr: Number(event.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-paper-sunken accent-purple-500" />
              <div className="flex justify-between text-[10px] font-semibold text-ink-faint"><span>0 IMR</span><span>Max IMR: {Math.min(100, imrBalance)}</span></div>
              {redeemedImr > 0 && <p className="flex items-center gap-1 text-[10px] font-semibold text-green-400"><i className="fa-solid fa-tags" />You get -₹{imrDiscount.toFixed(2)} discount (1 IMR = ₹0.50)</p>}
            </div>
          </div>}
          {currencyInr && !testPrice && !upgrade && imrBalance === 0 && <div className="mt-5 border-t border-line pt-4"><p className="text-[10px] text-ink-faint">No IMR balance available to redeem.</p></div>}
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Payment Method</h3>
            {currencyInr ? <div className="flex items-center gap-3 rounded-lg border border-line bg-paper-alt p-3"><div className="flex h-7 w-10 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand"><i className="fa-solid fa-credit-card" /></div><div><p className="text-xs font-semibold text-ink">Pay securely with PayU</p><p className="text-[10px] text-ink-faint">Supports cards, Net Banking, UPI</p></div></div>
              : <div className="flex items-center gap-3 rounded-lg border border-line bg-paper-alt p-3"><div className="flex h-7 w-10 items-center justify-center rounded-lg bg-yellow-900/40 text-xs font-bold text-yellow-400"><i className="fa-brands fa-paypal" /></div><div><p className="text-xs font-semibold text-ink">Pay securely with PayPal</p><p className="text-[10px] text-ink-faint">Cards, bank accounts, or PayPal balance</p></div></div>}
          </div>
          {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs leading-5 text-red-600 dark:text-red-300">{error}</p>}
          {currencyInr ? <button type="button" onClick={() => void payWithPayU()} disabled={loading}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? 'Opening PayU…' : <><i className="fa-solid fa-lock" />Pay {displayed} — Blue Teams {plan.name}</>}
          </button> : <div className="mt-5 min-h-12">
            {(paypalStatus === 'idle' || paypalStatus === 'loading') && <p className="rounded-lg bg-paper-sunken p-3 text-center text-xs text-ink-muted">Loading PayPal…</p>}
            <div ref={containerRef} />
            {paypalStatus === 'failed' && <button type="button" onClick={() => setPaypalAttempt(value => value + 1)} className="w-full rounded-lg bg-paper-sunken p-3 text-xs text-ink-muted">Try loading PayPal again</button>}
            {paypalStatus === 'ready' && loading && <p className="mt-2 text-center text-xs text-ink-muted">Completing PayPal checkout…</p>}
          </div>}
          <p className="mt-4 text-center text-[11px] leading-5 text-ink-faint">{currencyInr ? 'PayU securely processes INR payments.' : 'PayPal securely processes USD payments for international customers.'} Your payment details are handled by the payment provider.</p>
        </section>
        <aside className="lg:col-span-2 rounded-xl border border-line p-6 bg-paper-alt">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">Blue Teams · {plan.name}</p>
          <p className="mt-2 text-sm text-ink-muted">{plan.projectTeams} active project {plan.projectTeams === 1 ? 'team' : 'teams'} · up to {plan.agentsPerTeam} agents per team</p>
          <div className="my-5 space-y-2 border-t border-line pt-4">
            {currencyInr ? <>
              <p className="flex justify-between text-xs text-ink-muted"><span>{upgrade ? 'Prorated upgrade adjustment' : 'Subtotal'}</span><span className="text-ink">₹{Number(baseAmountInr).toLocaleString('en-IN')}</span></p>
              {imrDiscount > 0 && <p className="flex justify-between text-xs font-semibold text-brand"><span>IMR Discount Applied</span><span>-₹{imrDiscount.toFixed(2)}</span></p>}
              <p className="flex justify-between text-xs text-ink-muted"><span>Tax</span><span className="text-ink-faint">Included</span></p>
            </> : <>
              <p className="flex justify-between text-xs text-ink-muted"><span>Plan</span><span className="text-ink">Blue Teams {plan.name}</span></p>
              <p className="flex justify-between text-xs text-ink-muted"><span>Billing</span><span className="text-ink">{upgrade ? 'Remaining current period' : '30 days'}</span></p>
              <p className="flex justify-between text-xs text-ink-muted"><span>Tax</span><span className="text-ink-faint">Included</span></p>
            </>}
            <p className="mt-3 flex justify-between border-t border-line pt-3 text-sm font-bold text-ink"><span>Total due now</span><span className="bg-brand bg-clip-text text-transparent">{displayed}</span></p>
          </div>
          <p className="text-[11px] leading-6 text-ink-faint">One upfront payment. No automatic renewal. {upgrade ? 'This upgrades your existing plan after payment; it does not add a second subscription or an extra 30 days.' : quote?.mode === 'renewal' ? 'This adds 30 days to the same plan without losing time already paid for.' : 'Your selected plan starts after successful payment.'}</p>
          {quote && <p className="mt-3 text-xs text-ink-muted">{upgrade ? 'Current expiry' : 'Access through'}: {new Date(quote.effective_end).toLocaleString()}</p>}
          <p className="mt-4 text-[10px] text-ink-faint">Need help? <Link href="/contact" className="text-brand underline">Contact support</Link>.</p>
        </aside>
      </div>
    </section>
  </main>;
}
