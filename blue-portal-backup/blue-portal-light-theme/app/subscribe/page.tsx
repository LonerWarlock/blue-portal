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
    gradient: "from-brand to-brand",
    badge: "Current Plan",
    badgeStyle: "bg-brand",
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
    gradient: "from-brand to-brand",
    badge: "Most Popular",
    badgeStyle: "bg-brand",
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
    gradient: "from-brand to-brand",
    badge: "Starts at ₹100",
    badgeStyle: "bg-brand",
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
<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
</div>

      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
              Subscription
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Choose Your
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                Blue AI Plan
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Start free, choose the ₹149 monthly plan, or try paid models with the renewable ₹100 Blue Pro trial.
            </p>
            {user && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand/10 border border-line text-brand text-sm font-semibold">
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
                  ? "bg-brand" 
                  : "bg-brand";
              } else if (plan.name === "Blue Lite" && activePlan === "blue") {
                planBadge = "";
              }

              return (
                <div
                  key={plan.name}
                  className={`relative p-8 rounded-lg border transition-all duration-300 flex flex-col ${
                    plan.featured
                      ? "panel border-line  "
                      : "panel border-line hover:border-line-strong"
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
                    className={`w-12 h-12 rounded-lg bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-5 shadow-lg`}
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

                  <h3 className="text-2xl font-bold text-ink mb-1">{plan.name}</h3>
                  <p className="text-sm text-ink-faint mb-4">{plan.subtitle}</p>
                  <p className="text-ink-muted text-sm leading-relaxed mb-6">
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-ink">{plan.price}</span>
                    <span className="text-ink-faint text-lg">{plan.period}</span>
                  </div>

                  <ul className="mt-8 space-y-3 flex-1">
                    {allFeatures.map((feature, i) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-ink-muted">
                        {plan.features[i] ? (
                          <span className="w-4 h-4 rounded-full bg-green-950/60 border border-green-900/60 text-green-400 flex items-center justify-center shrink-0 text-[8px]">
                            <i className="fa-solid fa-check"></i>
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-paper-sunken border border-line-strong text-ink-faint flex items-center justify-center shrink-0 text-[8px]">
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
                      className="inline-flex w-full items-center justify-center px-6 py-3 rounded-lg bg-brand font-semibold text-white shadow-lg shadow-sm transition duration-200 text-base"
                    >
                      <i className="fa-solid fa-bolt mr-2"></i>
                      {plan.cta}
                    </Link>
                  ) : isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full px-6 py-3 rounded-lg bg-paper-sunken text-ink-faint font-semibold cursor-default border border-line text-base mt-6 inline-flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-circle-check text-green-500"></i>
                      Active Plan
                    </button>
                  ) : plan.name === "Blue Lite" && activePlan === "blue" ? (
                    <Link
                      href="/console"
                      className="inline-flex w-full items-center justify-center px-6 py-3 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-paper-sunken font-semibold transition duration-200 text-base mt-6"
                    >
                      Go to Console
                    </Link>
                  ) : plan.name === "Blue Lite" ? (
                    <Link
                      href={plan.href}
                      className="inline-flex w-full items-center justify-center px-6 py-3 rounded-lg bg-brand font-semibold text-white shadow-lg shadow-sm transition duration-200 text-base"
                    >
                      <i className="fa-solid fa-check mr-2"></i>
                      {plan.cta}
                    </Link>
                  ) : (
                    <button
                      onClick={handleSubscribe}
                      disabled={subscribing}
                      className="inline-flex w-full items-center justify-center px-6 py-3 rounded-lg bg-brand font-semibold text-white shadow-lg transition duration-200 text-base disabled:opacity-60 disabled:cursor-not-allowed"
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
            <p className="text-xs text-ink-faint">
              All current plans and Blue Pro credit packs are billed in INR. Prices include applicable taxes.
              <br />
              By subscribing, you agree to our{" "}
              <Link href="/terms" className="text-brand hover:text-brand underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-brand hover:text-brand underline">
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
