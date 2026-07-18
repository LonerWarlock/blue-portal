"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function CheckoutForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pack, setPack] = useState({ priceUSD: 15, credits: 15 });
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
      if (d) setPack(d);
    }).catch(() => {});
  }, []);

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
        body: JSON.stringify({ returnUrl })
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
            <p className="mt-2 text-gray-400">{pack.credits} Blue Credits will be added to your wallet.</p>
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

                  <div className="pt-3 border-t border-gray-800/80">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Payment Method</h3>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/40 border border-gray-800/80">
                      <div className="w-10 h-7 rounded-lg bg-purple-900/40 flex items-center justify-center text-purple-400 text-xs font-bold">
                        <i className="fa-solid fa-credit-card"></i>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-200">Pay securely with PayU</p>
                        <p className="text-[10px] text-gray-500">Supports cards, Net Banking, UPI, and international cards</p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-900/20 border border-red-800/50 text-red-400 text-xs flex items-start gap-2">
                      <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                      <span>{error}</span>
                    </div>
                  )}

                  <button type="button" onClick={handlePayment} disabled={loading}
                    className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {loading ? (
                      <><i className="fa-solid fa-spinner animate-spin"></i> Redirecting to PayU...</>
                    ) : (
                      <><i className="fa-solid fa-lock"></i> Pay ${pack.priceUSD.toFixed(2)} — Add {pack.credits} Blue Credits</>
                    )}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    Secured by <span className="text-purple-400 font-semibold">PayU Payments</span>.
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
                    <span className="text-gray-200 font-semibold">{pack.credits} Blue Credits</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Price</span>
                    <span className="text-gray-200 font-semibold">${pack.priceUSD.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Blue Credits are service-usage units used to access Blue's AI coding models.
                    They are not cash or stored monetary value. Credit consumption varies by model
                    and may include model inference, reasoning, caching, tools, and platform services.
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
