"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CurrencySelector } from "@/app/components/CurrencySelector";

interface CreditPack {
  id: "starter" | "standard" | "custom";
  name: string;
  description: string;
  priceINR: number;
  priceUSD: number;
  credits: number;
}

export function CheckoutForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<CreditPack["id"]>("starter");
  const [customCredits, setCustomCredits] = useState(10);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const txnidRef = useRef<string>('');

  const pack = packs.find(item => item.id === selectedPackId) || {
    id: "starter" as const,
    name: "Blue Pro Starter",
    description: "Renewable paid trial with selected models and no expiry.",
    priceINR: 100,
    priceUSD: 1.00,
    credits: 1
  };

  const activePack = selectedPackId === "custom"
    ? { ...pack, id: "custom" as const, name: "Blue Pro Custom", credits: customCredits, priceINR: customCredits * 100, priceUSD: customCredits * 1, description: `Custom pack with exactly ${customCredits} Blue Credits.` }
    : pack;

  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (!session) {
        sessionStorage.setItem("redirectAfterLogin", "/blue-pro/checkout");
        router.push("/console");
        return;
      }
      setEmail(session.user?.email || "");
    });

    fetch("/api/blue-pro/pack-config").then(r => r.ok && r.json()).then(d => {
      if (Array.isArray(d?.packs)) setPacks(d.packs);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (currency === "USD" && !paypalLoaded) {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=USD`;
      script.async = true;
      script.onload = () => setPaypalLoaded(true);
      script.onerror = () => console.error("Failed to load PayPal SDK");
      document.body.appendChild(script);
    }
  }, [currency, paypalLoaded]);

  useEffect(() => {
    if (currency === "USD" && paypalLoaded && (window as any).paypal) {
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
  }, [currency, paypalLoaded, selectedPackId, customCredits]);

  const handlePayment = async () => {
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

  return (
    <div className="min-h-screen bg-[#030712] flex items-center">
      <section className="relative w-full flex items-center overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 relative z-10 w-full py-12">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
                Complete Your Purchase
              </span>
            </h1>
            <p className="mt-2 text-gray-400">{activePack.credits} Blue Credits will be added to your wallet.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-4xl mx-auto">
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-gray-800/80 p-6 bg-gray-900/20 backdrop-blur-sm">
                <a href="/blue-pro/dashboard" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-4">
                  <i className="fa-solid fa-arrow-left"></i>
                  Back to Dashboard
                </a>

                <h2 className="text-base font-bold text-gray-100 mb-4">Contact Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
                    <input type="email" value={email} readOnly tabIndex={-1}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-900/60 border border-gray-800 text-gray-100 text-sm opacity-70 cursor-not-allowed" />
                  </div>

                  <CurrencySelector value={currency} onChange={setCurrency} />

                  <div className="pt-3 border-t border-gray-800/80">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Choose a credit pack</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(packs.length ? packs : [pack]).map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedPackId(item.id)}
                          className={`text-left rounded-xl border p-4 transition ${selectedPackId === item.id
                            ? "border-purple-400 bg-purple-500/10"
                            : "border-gray-800 bg-gray-900/30 hover:border-gray-700"}`}
                        >
                          <span className="block text-sm font-semibold text-gray-100">{item.name}</span>
                          <span className="mt-1 block text-xl font-bold text-white">
                            {currency === "INR" ? `₹${(item.priceINR || item.priceUSD * 100).toLocaleString("en-IN")}` : `$${item.priceUSD.toFixed(2)}`}
                          </span>
                          <span className="mt-1 block text-xs text-gray-400">{item.credits} Blue Credits</span>
                          <span className="mt-2 block text-[10px] leading-relaxed text-gray-500">{item.description}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedPackId("custom")}
                        className={`text-left rounded-xl border p-4 transition ${selectedPackId === "custom"
                          ? "border-purple-400 bg-purple-500/10"
                          : "border-gray-800 bg-gray-900/30 hover:border-gray-700"}`}
                      >
                        <span className="block text-sm font-semibold text-gray-100">Blue Pro Custom</span>
                        <span className="mt-1 block text-xs text-gray-400">{customCredits} Blue Credits</span>
                        <span className="mt-2 block text-[10px] leading-relaxed text-gray-500">Choose exactly how many credits you need (10–100).</span>
                      </button>
                    </div>
                    {selectedPackId === "custom" && (
                      <div className="mt-3 flex items-center gap-3">
                        <label className="text-xs text-gray-400 whitespace-nowrap">Blue Credits:</label>
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
                          className="w-24 px-3 py-2 rounded-xl bg-gray-900/60 border border-gray-800 text-gray-100 text-sm text-center focus:outline-none focus:border-purple-400 transition"
                        />
                        <span className="text-[10px] text-gray-500">
                          {currency === "INR" ? "₹100 per credit" : "$1 per credit"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-800/80">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Payment Method</h3>
                    {currency === "INR" ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/40 border border-gray-800/80">
                        <div className="w-10 h-7 rounded-lg bg-purple-900/40 flex items-center justify-center text-purple-400 text-xs font-bold">
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

                  {currency === "INR" ? (
                    <button type="button" onClick={handlePayment} disabled={loading}
                      className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {loading ? (
                        <><i className="fa-solid fa-spinner animate-spin"></i> Redirecting to PayU...</>
                      ) : (
                        <><i className="fa-solid fa-lock"></i> Pay ₹{(activePack.priceINR || activePack.priceUSD * 100).toLocaleString("en-IN")} - Add {activePack.credits} Blue Credits</>
                      )}
                    </button>
                  ) : (
                    <div id="paypal-button-container-bluepro" className="min-h-[50px]">
                      {!paypalLoaded && (
                        <div className="w-full px-6 py-3 rounded-xl bg-gray-800/50 flex items-center justify-center gap-2 text-sm text-gray-400">
                          <i className="fa-solid fa-spinner animate-spin"></i>
                          Loading PayPal...
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 text-center">
                    Secured by <span className="text-purple-400 font-semibold">
                      {currency === "INR" ? "PayU Payments" : "PayPal"}
                    </span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-gray-800/80 p-6 bg-gray-900/20 backdrop-blur-sm">
                <div className="flex items-start gap-3 pb-4 border-b border-gray-800/80">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shrink-0">
                    <i className="fa-solid fa-bolt text-sm text-white"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-100 text-sm">Blue Pro Credits</h3>
                    <p className="text-xs text-gray-500">Pay As You Go</p>
                  </div>
                </div>

                <div className="py-4 space-y-3 border-b border-gray-800/80">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Pack</span>
                    <span className="text-gray-200 font-semibold">{activePack.credits} Blue Credits</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Price</span>
                    <span className="text-gray-200 font-semibold">
                      {currency === "INR" ? `₹${(activePack.priceINR || activePack.priceUSD * 100).toLocaleString("en-IN")}` : `$${activePack.priceUSD.toFixed(2)}`}
                    </span>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Blue Credits are service-usage units used to access Blue&apos;s AI coding models.
                    They are not cash or stored monetary value. Credit consumption varies by model
                    and may include model inference, reasoning, caching, tools, and platform services.
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
