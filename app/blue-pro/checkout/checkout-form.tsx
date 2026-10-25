"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CurrencySelector } from "@/app/components/CurrencySelector";
import { customCreditPackDisplay, initialCreditCheckoutSelection, validCreditPackDisplay, type CreditPackDisplay } from "@/lib/creditCheckoutDisplay";

type CreditPack = CreditPackDisplay;

export function CheckoutForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<CreditPack["id"]>("starter");
  const [customCredits, setCustomCredits] = useState(25);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const txnidRef = useRef<string>('');

  const [configError, setConfigError] = useState("");
  const pack = packs.find(item => item.id === selectedPackId);
  const activePack = selectedPackId === "custom" ? customCreditPackDisplay(packs.find(item => item.id === "starter"), customCredits) : pack;
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
    setSelectedPackId(selected.packId); setCustomCredits(selected.customCredits);
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
    if (activePack && currency === "USD" && !paypalLoaded) {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=USD`;
      script.async = true;
      script.onload = () => setPaypalLoaded(true);
      script.onerror = () => console.error("Failed to load PayPal SDK");
      document.body.appendChild(script);
    }
  }, [currency, paypalLoaded, Boolean(activePack)]);

  useEffect(() => {
    if (activePack && currency === "USD" && paypalLoaded && (window as any).paypal) {
      const container = document.getElementById("paypal-button-container-bluepro");
      if (container) container.innerHTML = "";

      (window as any).paypal.Buttons({
        style: { layout: "vertical", color: "blue", shape: "rect", label: "paypal", height: 45 },
        createOrder: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("Not authenticated");

          const res = await fetch("/api/blue-pro/paypal/create-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ returnUrl: `${window.location.origin}/console`, packId: selectedPackId, customCredits: selectedPackId === "custom" ? customCredits : undefined })
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || "Failed to create PayPal order");
          txnidRef.current = data.txnid || '';
          return data.orderId;
        },
        onApprove: async (data: { orderID: string }) => {
          window.location.href = `/api/blue-pro/paypal/capture?token=${data.orderID}&txnid=${txnidRef.current}`;
        },
        onError: (err: any) => {
          setError(err.message || "PayPal payment failed");
          setLoading(false);
        },
      }).render("#paypal-button-container-bluepro");
    }
  }, [currency, paypalLoaded, selectedPackId, customCredits, Boolean(activePack)]);

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
        body: JSON.stringify({ returnUrl, packId: selectedPackId, customCredits: selectedPackId === "custom" ? customCredits : undefined })
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

  if (!activePack) return <main className="min-h-screen bg-paper flex items-center justify-center p-6"><section className="max-w-md rounded-lg border border-line p-6 bg-paper-alt" aria-live="polite">
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
            <p className="mt-2 text-ink-muted">{activePack.credits} Blue Credits will be added to your wallet.</p>
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
                        <span className="mt-1 block text-xs text-ink-muted">{customCredits} Blue Credits</span>
                        <span className="mt-2 block text-[10px] leading-relaxed text-ink-faint">Choose exactly how many credits you need (10–100).</span>
                      </button>
                    </div>
                    {selectedPackId === "custom" && (
                      <div className="mt-3 flex items-center gap-3">
                        <label className="text-xs text-ink-muted whitespace-nowrap">Blue Credits:</label>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          step={1}
                          value={customCredits}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v)) setCustomCredits(Math.max(10, Math.min(100, v)));
                          }}
                          className="w-24 px-3 py-2 rounded-lg bg-paper-alt border border-line text-ink text-sm text-center focus:outline-none focus:border-brand transition"
                        />
                        <span className="text-[10px] text-ink-faint">
                          {currency === "INR" ? "Credit subtotal uses the checkout INR rate; 30% fee added" : "$1 per credit + 30% platform fee"}
                        </span>
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
                    <button type="button" onClick={handlePayment} disabled={loading}
                      className="w-full px-6 py-3 rounded-lg bg-brand font-bold text-white shadow-lg shadow-sm transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {loading ? (
                        <><i className="fa-solid fa-spinner animate-spin"></i> Redirecting to PayU...</>
                      ) : (
                        <><i className="fa-solid fa-lock"></i> Pay {formatPrice(activePack.priceINR)} - Add {activePack.credits} Blue Credits</>
                      )}
                    </button>
                  ) : (
                    <div id="paypal-button-container-bluepro" className="min-h-[50px]">
                      {!paypalLoaded && (
                        <div className="w-full px-6 py-3 rounded-lg bg-paper-sunken flex items-center justify-center gap-2 text-sm text-ink-muted">
                          <i className="fa-solid fa-spinner animate-spin"></i>
                          Loading PayPal...
                        </div>
                      )}
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
                    <span className="text-ink font-semibold">{activePack.credits} Blue Credits</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">Credit subtotal</span>
                    <span className="text-ink font-semibold">
                      {formatPrice(currency === "INR" ? activePack.basePriceINR : activePack.basePriceUSD)}
                    </span>
                  </div>
                </div>

                <div className="py-4 space-y-3 border-b border-line">
                  <div className="flex justify-between text-sm"><span className="text-ink-muted">Platform fee (30%)</span><span className="text-ink font-semibold">{formatPrice(currency === "INR" ? activePack.platformFeeINR : activePack.platformFeeUSD)}</span></div>
                  <div className="flex justify-between text-base"><span className="text-ink font-bold">Total payable</span><span className="text-ink font-bold">{formatPrice(currency === "INR" ? activePack.priceINR : activePack.priceUSD)}</span></div>
                </div>
                <div className="pt-4 space-y-2">
                  <p className="text-xs text-ink-muted">{activePack.credits >= 25 ? "This purchase qualifies to activate or reactivate Blue Teams." : "Teams activation and reactivation need at least 25 credits in one purchase. Smaller packs can extend access that is already active."}</p>
                  <p className="text-xs text-ink-muted">1 Blue Credit covers $1 of actual OpenRouter model usage. The platform fee does not add credits.</p>
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
