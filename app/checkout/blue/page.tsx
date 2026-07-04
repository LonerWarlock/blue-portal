"use client";

import { useState } from "react";
import PageLayout from "@/app/components/PageLayout";

export default function CheckoutPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      alert("Razorpay checkout will open here.");
      setLoading(false);
    }, 1000);
  }

  return (
    <PageLayout>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[160px]"></div>
      </div>

      <section className="relative min-h-screen flex items-center py-20">
        <div className="max-w-5xl mx-auto px-6 relative z-10 w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Checkout
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Complete Your Subscription
              </span>
            </h1>
            <p className="mt-4 text-gray-400 max-w-lg mx-auto">
              You are one step away from unlocking the full power of Blue AI.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-4xl mx-auto">
            <div className="lg:col-span-3">
              <div className="glass rounded-2xl border border-gray-800/80 p-8">
                <h2 className="text-lg font-bold text-gray-100 mb-6">Contact Information</h2>
                <form onSubmit={handlePayment} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-800 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition text-sm"
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-800/80">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Payment Method</h3>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-900/40 border border-gray-800/80">
                      <div className="w-12 h-8 rounded-lg bg-blue-900/40 flex items-center justify-center text-blue-400 text-xs font-bold">
                        <i className="fa-solid fa-credit-card"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-200">Pay with Razorpay</p>
                        <p className="text-xs text-gray-500">Credit / Debit card, UPI, Net Banking, Wallet</p>
                      </div>
                      <div className="ml-auto">
                        <i className="fa-solid fa-chevron-right text-gray-600 text-sm"></i>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin"></i>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-lock"></i>
                        Pay ₹149 — Subscribe to Blue
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-600 text-center">
                    Your payment is secured by{" "}
                    <span className="text-blue-400 font-semibold">Razorpay</span>.
                    We never store your card details.
                  </p>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="glass rounded-2xl border border-gray-800/80 p-8 lg:sticky lg:top-28">
                <h2 className="text-lg font-bold text-gray-100 mb-6">Order Summary</h2>

                <div className="flex items-start gap-4 pb-6 border-b border-gray-800/80">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shrink-0">
                    <i className="fa-solid fa-crown text-lg text-white"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-100">Blue Plan</h3>
                    <p className="text-sm text-gray-500">Full access to all Blue AI features</p>
                  </div>
                </div>

                <div className="py-5 space-y-3 border-b border-gray-800/80">
                  {[
                    "Access to all models (Claude, GPT, Gemini)",
                    "1,000 requests per day",
                    "API key access",
                    "Priority email support",
                  ].map((feature) => (
                    <div key={feature} className="flex items-start gap-3 text-sm text-gray-400">
                      <span className="w-5 h-5 rounded-full bg-blue-950/60 border border-blue-900/60 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                        <i className="fa-solid fa-check"></i>
                      </span>
                      {feature}
                    </div>
                  ))}
                </div>

                <div className="pt-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-gray-200">₹149</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Tax</span>
                    <span className="text-gray-500">Included</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-3 border-t border-gray-800/80">
                    <span className="text-gray-100">Total</span>
                    <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">₹149</span>
                  </div>
                </div>

                <p className="mt-4 text-xs text-gray-600 text-center">
                  Billed monthly. Cancel anytime.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center max-w-2xl mx-auto p-6 rounded-2xl glass border border-gray-800/80">
            <div className="flex items-center justify-center gap-3 mb-3">
              <i className="fa-solid fa-shield-halved text-blue-400 text-lg"></i>
              <span className="text-sm text-gray-400">
                Secured by <span className="text-blue-400 font-semibold">Razorpay</span>
              </span>
            </div>
            <p className="text-xs text-gray-600">
              By subscribing, you agree to our{" "}
              <a href="/terms" className="text-blue-400 hover:text-blue-300 underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                Privacy Policy
              </a>
              . You can cancel anytime from your account settings.
            </p>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
