"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CurrencySelector } from "@/app/components/CurrencySelector";
import { customCreditPackDisplay, customInrPackDisplay, customUsdPackDisplay, initialCreditCheckoutSelection, validCreditPackDisplay, type CreditPackDisplay } from "@/lib/creditCheckoutDisplay";

type CreditPack = CreditPackDisplay;

export function CheckoutForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<CreditPack["id"]>("starter");
  const [customCredits, setCustomCredits] = useState("25");
  const [customInput, setCustomInput] = useState<"credits" | "amount">("credits");
  const [customInrAmount, setCustomInrAmount] = useState("2875");
  const [customUsdAmount, setCustomUsdAmount] = useState("32.50");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalStatus, setPaypalStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [paypalAttempt, setPaypalAttempt] = useState(0);
  const paypalContainerRef = useRef<HTMLDivElement | null>(null);
  const txnidRef = useRef<string>('');
  const paypalScriptRef = useRef<HTMLScriptElement | null>(null);

  const [configError, setConfigError] = useState("");
  const pack = packs.find(item => item.id === selectedPackId);
  const customByAmount = customInput === "amount";
  const customAmount = currency === "INR" ? customInrAmount : customUsdAmount;
  const customValue = customByAmount ? customAmount : customCredits;
  const customLimit = customByAmount ? (currency === "INR" ? 11500 : 130) : 100;
  const referencePack = packs.find(item => item.id === "starter");
  const activePack = selectedPackId === "custom"
    ? (customByAmount ? (currency === "INR" ? customInrPackDisplay(referencePack, Number(customInrAmount))
      : customUsdPackDisplay(referencePack, Number(customUsdAmount)))
      : customCreditPackDisplay(referencePack, Number(customCredits))) : pack;
  const purchaseSelection = selectedPackId === "custom"
    ? (customByAmount ? (currency === "INR" ? { packId: selectedPackId, customInrAmount: Number(customInrAmount) }
      : { packId: selectedPackId, customUsdAmount: Number(customUsdAmount) })
      : { packId: selectedPackId, customCredits: Number(customCredits) }) : { packId: selectedPackId };
  const setCustomValue = (value: string) => {
    if (!customByAmount) setCustomCredits(value);
    else if (currency === "INR") setCustomInrAmount(value);
    else setCustomUsdAmount(value);
  };
  const normalizeMinimum = () => {
    if (!customValue.trim() || Number(customValue) <= 0) setCustomValue("1");
  };
  const checkoutRef = useRef({ activePack, purchaseSelection, configError, currency });
  checkoutRef.current = { activePack, purchaseSelection, configError, currency };
  const formatCredits = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 10 });
  const formatPrice = (value: number) => currency === "INR" ? `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${value.toFixed(2)}`;
  const loadPacks = async () => {
    setConfigError("");
    try {
      const response = await fetch("/api/blue-pro/pack-config", { cache: "no-store" });
      if (!response.ok) throw new Error("Credit prices could not be loaded.");
      const data = await response.json();
      if (!Array.isArray(data?.packs) || !data.packs.length || !data.packs.every(validCreditPackDisplay)) throw new Error("Credit prices could not be verified.");
      const ids = data.packs.map((item: CreditPack) => item.id);
      if (!ids.includes("starter") || !ids.includes("standard") || new Set(ids).size !== ids.length) throw new Error("Credit pack choices could not be verified.");
      setPacks(data.packs);
    } catch (cause) { setPacks([]); setConfigError(cause instanceof Error ? cause.message : "Credit prices could not be loaded."); }
  };

  const [email, setEmail] = useState("");

  useEffect(() => {
    const selected = initialCreditCheckoutSelection(window.location.search);
    setCurrency(new URLSearchParams(window.location.search).get('currency')==='USD'?'USD':'INR');
    setSelectedPackId(selected.packId); setCustomCredits(String(selected.customCredits));
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (!session) {
        sessionStorage.setItem("redirectAfterLogin", `/blue-pro/checkout${window.location.search}`);
        router.push("/console");
        return;
      }
      setEmail(session.user?.email || "");
    });

    void loadPacks();
  }, []);

  useEffect(() => {
    if (activePack && currency === "USD" && !paypalLoaded && !paypalScriptRef.current) {
      setPaypalStatus("loading");
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=USD`;
      script.async = true;
      paypalScriptRef.current = script;
      script.onload = () => setPaypalLoaded(true);
      script.onerror = () => { paypalScriptRef.current = null; setPaypalStatus("failed"); setError("PayPal could not load. Please try again."); };
      document.body.appendChild(script);
    }
  }, [currency, paypalLoaded, Boolean(activePack), paypalAttempt]);

  useEffect(() => {
    if (!activePack || currency !== "USD" || !paypalLoaded || !paypalContainerRef.current) return;
    let active = true;
    let buttons: any;
    // React owns the empty outer element; this render alone owns the SDK child.
    // Late SDK cleanup can only remove its own detached child, never newer controls.
    const container = document.createElement("div");
    paypalContainerRef.current.replaceChildren(container);
    setPaypalStatus("loading");
    setError("");
    const closeButtons = () => {
      try { void Promise.resolve(buttons?.close?.()).catch(() => {}); } catch { /* Already closed. */ }
    };
    const renderButtons = async () => {
      try {
        if (!(window as any).paypal) throw new Error("PayPal SDK is unavailable.");
        buttons = (window as any).paypal.Buttons({
          style: { layout: "vertical", color: "blue", shape: "rect", label: "paypal", height: 45 },
          createOrder: async () => {
            const currentCheckout = checkoutRef.current;
            if (!active || currentCheckout.currency !== "USD") throw new Error("Checkout has changed. Please try again.");
            if (!currentCheckout.activePack || currentCheckout.configError) throw new Error("Enter a valid purchase amount first.");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");
            if (!active) throw new Error("Checkout has changed. Please try again.");
            const res = await fetch("/api/blue-pro/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ returnUrl: `${window.location.origin}/console`, ...currentCheckout.purchaseSelection })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Failed to create PayPal order");
            if (!active) throw new Error("Checkout has changed. Please try again.");
            txnidRef.current = data.txnid || '';
            return data.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            if (!active) return;
            window.location.href = `/api/blue-pro/paypal/capture?token=${data.orderID}&txnid=${txnidRef.current}`;
          },
          onError: (err: any) => {
            if (!active) return;
            setError(err.message || "PayPal payment failed");
            setLoading(false);
          },
        });
        await buttons.render(container);
        if (active) setPaypalStatus("ready"); else closeButtons();
      } catch {
        if (!active) return;
        closeButtons();
        setPaypalStatus("failed");
        setError("PayPal could not load. Please try again.");
      }
    };
    void renderButtons();
    return () => { active = false; closeButtons(); container.remove(); };
  }, [currency, paypalLoaded, Boolean(activePack), paypalAttempt]);

  const handlePayment = async () => {
    if (!activePack || configError) return;
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const returnUrl = `${window.location.origin}/console`;

      const hashRes = await fetch("/api/blue-pro/payu/create-hash", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ returnUrl, ...purchaseSelection })
      });

      const hashData = await hashRes.json();
      if (!hashRes.ok || hashData.error) {
        throw new Error(hashData.error || "Failed to generate payment");
      }

      const form = document.createElement("form");
      form.action = hashData.payuUrl;
      form.method = "POST";

      const params: Record<string, string> = {
        key: hashData.key,
        txnid: hashData.txnid,
        amount: hashData.amount,
        productinfo: hashData.productinfo,
        firstname: hashData.firstname,
        email: hashData.email,
        phone: "9999999999",
        surl: `${window.location.origin}/api/blue-pro/payu/callback`,
        furl: `${window.location.origin}/api/blue-pro/payu/callback`,
        hash: hashData.hash,
        service_provider: "payu_paisa"
      };

      for (const [k, v] of Object.entries(params)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  if (!packs.length || configError) return <main className="min-h-screen bg-paper flex items-center justify-center p-6"><section className="max-w-md rounded-lg border border-line p-6 bg-paper-alt" aria-live="polite">
    <h1 className="text-xl font-bold text-ink">Blue Credit checkout</h1>
    <p className="mt-3 text-sm text-ink-muted">{configError || "Loading current credit prices…"}</p>
    {configError && <button type="button" className="btn btn-primary mt-4" onClick={() => void loadPacks()}>Retry prices</button>}
  </section></main>;

  return (
    <div className="min-h-screen bg-paper flex items-center">
      <section className="relative w-full flex items-center overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 relative z-10 w-full py-12">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              <span className="bg-brand bg-clip-text text-transparent">
                Complete Your Purchase
              </span>
            </h1>
            <p className="mt-2 text-ink-muted">{activePack ? `${formatCredits(activePack.credits)} Blue Credits will be added to your wallet.` : "Enter a valid amount to see your credits."}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-4xl mx-auto">
            <div className="lg:col-span-3">
              <div className="rounded-lg border border-line p-6 bg-paper-alt">
                <a href="/blue-pro/dashboard" className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink-muted transition-colors mb-4">
                  <i className="fa-solid fa-arrow-left"></i>
                  Back to Dashboard
                </a>

                <h2 className="text-base font-bold text-ink mb-4">Contact Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1.5">Email Address</label>
                    <input type="email" value={email} readOnly tabIndex={-1}
                      className="w-full px-4 py-2.5 rounded-lg bg-paper-alt border border-line text-ink text-sm opacity-70 cursor-not-allowed" />
                  </div>

                  <CurrencySelector value={currency} onChange={setCurrency} />

                  <div className="pt-3 border-t border-line">
                    <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">Choose a credit pack</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {packs.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedPackId(item.id)}
                          className={`text-left rounded-lg border p-4 transition ${selectedPackId === item.id
                            ? "border-brand bg-brand/10"
                            : "border-line bg-paper-alt hover:border-line-strong"}`}
                        >
                          <span className="block text-sm font-semibold text-ink">{item.name}</span>
                          <span className="mt-1 block text-xl font-bold text-ink">
                            {formatPrice(currency === "INR" ? item.priceINR : item.priceUSD)}
                          </span>
                          <span className="mt-1 block text-xs text-ink-muted">{item.credits} Blue Credits</span>
                          <span className="mt-2 block text-[10px] leading-relaxed text-ink-faint">{item.description}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedPackId("custom")}
                        className={`text-left rounded-lg border p-4 transition ${selectedPackId === "custom"
                          ? "border-brand bg-brand/10"
                          : "border-line bg-paper-alt hover:border-line-strong"}`}
                      >
                        <span className="block text-sm font-semibold text-ink">Blue Credits Custom</span>
                        <span className="mt-1 block text-xs text-ink-muted">{customByAmount ? (customAmount ? `${currency === "INR" ? "₹" : "$"}${customAmount}` : "Enter an amount") : `${customCredits || "—"} Blue Credits`}</span>
                        <span className="mt-2 block text-[10px] leading-relaxed text-ink-faint">Choose 1–100 credits, or enter an amount.</span>
                      </button>
                    </div>
                    {selectedPackId === "custom" && (
                      <div className="mt-3 space-y-3">
                        <div className="flex gap-2" role="group" aria-label="Custom purchase amount">
                          <button type="button" aria-pressed={!customByAmount} onClick={() => setCustomInput("credits")} className={`rounded-lg border px-3 py-2 text-xs ${!customByAmount ? "border-brand text-brand" : "border-line text-ink-muted"}`}>By credits</button>
                          <button type="button" aria-pressed={customByAmount} onClick={() => setCustomInput("amount")} className={`rounded-lg border px-3 py-2 text-xs ${customByAmount ? "border-brand text-brand" : "border-line text-ink-muted"}`}>By {currency} amount</button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <label htmlFor="custom-blue-credit-amount" className="text-xs text-ink-muted whitespace-nowrap">{customByAmount ? `Amount (${currency}):` : "Blue Credits:"}</label>
                          <input id="custom-blue-credit-amount" type="number" min={1} max={customLimit} step={customByAmount ? 0.01 : 1}
                            value={customValue} onChange={e => setCustomValue(e.target.value)} onBlur={normalizeMinimum}
                            aria-invalid={!activePack} aria-describedby={!activePack ? "custom-blue-credit-error" : undefined}
                            className="w-32 px-3 py-2 rounded-lg bg-paper-alt border border-line text-ink text-sm text-center focus:outline-none focus:border-brand transition" />
                          <span className="text-xs text-ink-faint">{currency === "INR" ? "1 Blue Credit = ₹115" : "$1.30 / Credit"}</span>
                        </div>
                        {!activePack && <p id="custom-blue-credit-error" className="text-xs text-ink-muted">{customByAmount ? `Enter an amount from ${currency === "INR" ? "₹1 to ₹11,500" : "$1 to $130"}, with up to two decimal places.` : "Enter 1–100 whole credits."}</p>}
                        {customByAmount && activePack && <p className="text-xs text-ink-muted">{formatPrice(Number(customAmount))} ÷ {currency === "INR" ? "115" : "1.30"} = {formatCredits(activePack.credits)} Blue Credits</p>}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-line">
                    <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">Payment Method</h3>
                    {currency === "INR" ? (
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

                  {currency === "INR" ? (
                    <button type="button" onClick={handlePayment} disabled={loading || !activePack}
                      className="w-full px-6 py-3 rounded-lg bg-brand font-bold text-white shadow-lg shadow-sm transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {loading ? (
                        <><i className="fa-solid fa-spinner animate-spin"></i> Redirecting to PayU...</>
                      ) : (
                        <><i className="fa-solid fa-lock"></i> {activePack ? `Pay ${formatPrice(activePack.priceINR)} - Add ${formatCredits(activePack.credits)} Blue Credits` : "Enter a valid amount"}</>
                      )}
                    </button>
                  ) : (
                    <div className="min-h-[50px]">
                      {!activePack ? <p className="text-xs text-ink-muted">Enter a valid amount to continue with PayPal.</p> : (paypalStatus === "idle" || paypalStatus === "loading") && (
                        <div className="w-full px-6 py-3 rounded-lg bg-paper-sunken flex items-center justify-center gap-2 text-sm text-ink-muted">
                          <i className="fa-solid fa-spinner animate-spin"></i>
                          Loading PayPal...
                        </div>
                      )}
                      <div id="paypal-button-container-bluepro" ref={paypalContainerRef} />
                      {activePack && paypalStatus === "failed" && <button type="button" className="w-full px-6 py-3 rounded-lg bg-paper-sunken text-sm text-ink-muted"
                        onClick={() => { setError(""); setPaypalStatus("loading"); setPaypalAttempt(attempt => attempt + 1); }}>Try loading PayPal again</button>}
                    </div>
                  )}

                  <p className="text-xs text-ink-muted text-center">
                    Secured by <span className="text-brand font-semibold">
                      {currency === "INR" ? "PayU Payments" : "PayPal"}
                    </span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-lg border border-line p-6 bg-paper-alt">
                <div className="flex items-start gap-3 pb-4 border-b border-line">
                  <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center shadow-lg shrink-0">
                    <i className="fa-solid fa-bolt text-sm text-white"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-sm">Blue Pro Credits</h3>
                    <p className="text-xs text-ink-faint">Pay As You Go</p>
                  </div>
                </div>

                <div className="py-4 space-y-3 border-b border-line">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">Pack</span>
                    <span className="text-ink font-semibold">{activePack ? `${formatCredits(activePack.credits)} Blue Credits` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">Rate per credit</span>
                    <span className="text-ink font-semibold">
                      {currency === "INR" ? "₹115" : "$1.30"}
                    </span>
                  </div>
                </div>

                <div className="py-4 space-y-3 border-b border-line">
                  <div className="flex justify-between text-base"><span className="text-ink font-bold">Total payable</span><span className="text-ink font-bold">{activePack ? formatPrice(currency === "INR" ? activePack.priceINR : activePack.priceUSD) : "—"}</span></div>
                </div>
                <div className="pt-4 space-y-2">
                  <p className="text-xs text-ink-muted">{activePack && (activePack.credits >= 25 ? "This purchase qualifies to activate or reactivate Blue Teams." : "Teams activation and reactivation need at least 25 credits in one purchase. Smaller packs can extend access that is already active.")}</p>
                  <p className="text-xs text-ink-muted">1 Blue Credit covers $1 of actual OpenRouter model usage. The displayed price is the final total.</p>
                  <p className="text-[10px] text-ink-faint leading-relaxed">
                    Blue Credits are service-usage units used to access Blue&apos;s AI coding models.
                    They are not cash or stored monetary value. Credit consumption varies by model
                    and may include model inference, reasoning, caching and tool-related model usage.
                    Credits do not expire; add another pack whenever your balance runs out.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
