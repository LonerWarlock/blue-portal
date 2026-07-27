"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const allFeatures = [
  "AI Chat",
  "Code Autocomplete",
  "Codebase Search",
  "Syntax Checking",
  "Cloud Models",
  "Local Models",
  "Multi-Agent Teams",
  "Figma-to-Code",
  "GitHub Integration",
  "Web Search",
  "Makes Premium UI",
  "Premium Models",
  
];

const plans = [
  {
    name: "Blue Lite",
    subtitle: "Free forever",
    price: "₹0",
    period: "",
    gradient: "from-green-500 to-teal-500",
    badge: "Current Plan",
    badgeStyle: "bg-gradient-to-r from-green-600 to-teal-600",
    href: "/console",
    cta: "Get Started Free",
    description: "Baseline features common in any modern SOTA coding agent.",
    features: [true, true, true, true, true, true, false, false, false, false, false, false],
    featured: false,
  },
  {
    name: "Blue",
    subtitle: "₹149 / month",
    price: "₹149",
    period: "/month",
    gradient: "from-blue-500 to-indigo-500",
    badge: "Most Popular",
    badgeStyle: "bg-gradient-to-r from-blue-600 to-indigo-600",
    href: "",
    cta: "Subscribe Now",
    description: "Advanced integrations and orchestration with Free/BYOK models.",
    features: [true, true, true, true, true, true, true, true, true, true, true, false],
    featured: true,
  },
  {
    name: "Blue Pro",
    subtitle: "₹100 paid trial · no expiry",
    price: "₹100",
    period: "/1 credit",
    gradient: "from-purple-500 to-pink-500",
    badge: "Starts at ₹100",
    badgeStyle: "bg-gradient-to-r from-purple-600 to-pink-600",
    href: "/blue-pro/checkout?pack=starter",
    cta: "Buy ₹100 Trial",
    description: "Try selected paid models for ₹100. Credits never expire; renew the trial or choose the ₹1,500 full-access pack whenever you need more.",
    features: [true, true, true, true, true, true, true, true, true, true, true, true],
    featured: false,
    disabled: false,
  },
];

export default function SubscribePage() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [subscribing, setSubscribing] = useState(false);
  const [activePlan, setActivePlan] = useState<string>("lite");
  const [imrBalance, setImrBalance] = useState<number>(0);

  useEffect(() => {
    if (user?.email) {
      fetch(`/api/user/subscription?email=${encodeURIComponent(user.email)}`)
        .then(res => res.json())
        .then(data => {
          if (data.plan) {
            setActivePlan(data.plan);
          }
        })
        .catch(err => console.error("Error loading subscription plan:", err));

      const token = session?.access_token;
      if (token) {
        fetch('/api/user/wallet', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data && data.balance !== undefined) {
              setImrBalance(data.balance);
            }
          })
          .catch(err => console.error("Error loading wallet balance:", err));
      }
    } else {
      setActivePlan("lite");
      setImrBalance(0);
    }
  }, [user, session]);

  const handleSubscribe = async () => {
    if (!user) {
      sessionStorage.setItem("redirectAfterLogin", "/subscribe");
      router.push("/console");
      return;
    }

    setSubscribing(true);
    try {
      const token = session?.access_token;
      if (!token) throw new Error("No session token");

      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: "blue", billing_cycle: "monthly" }),
      });

      const data = await res.json();
      if (!res.ok || !data.session_id) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      const returnUrl = `${window.location.origin}/console`;
      window.location.href = `/checkout/blue?session_id=${data.session_id}&return_url=${encodeURIComponent(returnUrl)}`;
    } catch (err: any) {
      console.error("Subscribe error:", err);
      alert("Something went wrong. Please try again.");
      setSubscribing(false);
    }
  };

  return (
    <PageLayout>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[160px]"></div>
      </div>

      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-semibold mb-8">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Subscription
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Choose Your
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Blue AI Plan
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Start free, choose the ₹149 monthly plan, or try paid models with the renewable ₹100 Blue Pro trial.
            </p>
            {user && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-400 text-sm font-semibold">
                <i className="fa-solid fa-wallet"></i>
                <span>Your Balance: {imrBalance.toFixed(0)} IMR</span>
              </div>
            )}
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {plans.map((plan) => {
              const isCurrentPlan = (plan.name === "Blue Lite" && activePlan === "lite") || 
                                    (plan.name === "Blue" && activePlan === "blue") ||
                                    (plan.name === "Blue Pro" && (activePlan === "blue_pro" || activePlan === "pro_payg"));
              
              let planBadge = plan.badge;
              let planBadgeStyle = plan.badgeStyle;

              if (isCurrentPlan) {
                planBadge = "Current Plan";
                planBadgeStyle = plan.name === "Blue" 
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600" 
                  : "bg-gradient-to-r from-green-600 to-teal-600";
              } else if (plan.name === "Blue Lite" && activePlan === "blue") {
                planBadge = "";
              }

              return (
                <div
                  key={plan.name}
                  className={`relative p-8 rounded-2xl border transition-all duration-300 flex flex-col ${
                    plan.featured
                      ? "glass border-blue-500/40 shadow-xl shadow-blue-500/10"
                      : "glass border-gray-800/80 hover:border-gray-700/80"
                  } ${plan.disabled ? "opacity-70" : ""}`}
                >
                  {planBadge && (
                    <span
                      className={`absolute -top-2.5 right-4 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-lg ${planBadgeStyle}`}
                    >
                      {planBadge}
                    </span>
                  )}

                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-5 shadow-lg`}
                  >
                    <i
                      className={`fa-solid ${
                        plan.name === "Blue Lite"
                          ? "fa-gem"
                          : plan.name === "Blue"
                            ? "fa-crown"
                            : "fa-rocket"
                      } text-lg text-white`}
                    ></i>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-100 mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{plan.subtitle}</p>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-100">{plan.price}</span>
                    <span className="text-gray-500 text-lg">{plan.period}</span>
                  </div>

                  <ul className="mt-8 space-y-3 flex-1">
                    {allFeatures.map((feature, i) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-gray-400">
                        {plan.features[i] ? (
                          <span className="w-4 h-4 rounded-full bg-green-950/60 border border-green-900/60 text-green-400 flex items-center justify-center shrink-0 text-[8px]">
                            <i className="fa-solid fa-check"></i>
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-gray-800/60 border border-gray-700/60 text-gray-600 flex items-center justify-center shrink-0 text-[8px]">
                            <i className="fa-solid fa-xmark"></i>
                          </span>
                        )}
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {plan.name === "Blue Pro" ? (
                    <Link
                      href={plan.href}
                      className="inline-flex w-full items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition duration-200 text-base"
                    >
                      <i className="fa-solid fa-bolt mr-2"></i>
                      {plan.cta}
                    </Link>
                  ) : isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full px-6 py-3 rounded-xl bg-gray-800/40 text-gray-500 font-semibold cursor-default border border-gray-800/50 text-base mt-6 inline-flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-circle-check text-green-500"></i>
                      Active Plan
                    </button>
                  ) : plan.name === "Blue Lite" && activePlan === "blue" ? (
                    <Link
                      href="/console"
                      className="inline-flex w-full items-center justify-center px-6 py-3 rounded-xl border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800/50 font-semibold transition duration-200 text-base mt-6"
                    >
                      Go to Console
                    </Link>
                  ) : plan.name === "Blue Lite" ? (
                    <Link
                      href={plan.href}
                      className="inline-flex w-full items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 font-semibold text-white shadow-lg shadow-green-500/20 hover:from-green-500 hover:to-teal-500 transition duration-200 text-base"
                    >
                      <i className="fa-solid fa-check mr-2"></i>
                      {plan.cta}
                    </Link>
                  ) : (
                    <button
                      onClick={handleSubscribe}
                      disabled={subscribing}
                      className="inline-flex w-full items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {subscribing ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
                          Redirecting...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-arrow-right mr-2"></i>
                          {plan.cta}
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-600">
              All current plans and Blue Pro credit packs are billed in INR. Prices include applicable taxes.
              <br />
              By subscribing, you agree to our{" "}
              <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
