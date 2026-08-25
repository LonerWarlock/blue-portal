"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const modelPricing = [
  { model: "DeepSeek V4 Flash", inputCredits: "0.147", outputCredits: "0.294", tier: "Low Cost" },
  { model: "Poolside Laguna S 2.1", inputCredits: "0.150", outputCredits: "0.300", tier: "Low Cost" },
  { model: "KAT Coder Air 2.5", inputCredits: "0.225", outputCredits: "0.900", tier: "Low Cost" },
  { model: "DeepSeek V4 Pro", inputCredits: "0.653", outputCredits: "1.305", tier: "Standard" },
  { model: "Qwen 3.7 Plus", inputCredits: "0.480", outputCredits: "1.920", tier: "Standard" },
  { model: "GLM 5", inputCredits: "0.900", outputCredits: "2.880", tier: "Standard" },
];

const tiers = [
  { name: "Low Cost", color: "from-brand to-brand", description: "Everyday coding tasks, autocomplete, quick fixes" },
  { name: "Standard", color: "from-brand to-brand", description: "Complex reasoning, refactoring, multi-file edits" },
  { name: "High Cost", color: "from-brand to-brand", description: "Advanced agentic workflows, deep research" },
  { name: "Premium", color: "from-brand to-brand", description: "Maximum intelligence, flagship models" },
];

const faqs = [
  {
    q: "What are Blue Credits?",
    a: "Blue Credits are service-usage units for Blue's pay-as-you-go models. The renewable Starter pack costs ₹100 for 1 Blue Credit and the Full pack costs ₹1,500 for 15 Blue Credits. There is no time limit."
  },
  {
    q: "How is credit usage calculated?",
    a: "Blue uses the actual cost reported by OpenRouter for each completed request, then converts it into Blue Credits at the published Blue rate. The extension updates your remaining balance after every request."
  },
  {
    q: "Do my credits expire?",
    a: "No. Blue Credits do not expire and do not reset monthly. They remain in your wallet until you use them."
  },
  {
    q: "What happens when I run out of credits?",
    a: "Paid model requests stop when your balance reaches zero. You can buy another pack at any time to continue. Your account stays active — there is no subscription to cancel."
  },
  {
    q: "Can I use free models without credits?",
    a: "Blue Pro is for paid OpenRouter models. Users without active Blue Pro credits can continue with their own OpenCode API key."
  },
  {
    q: "Are there any refunds?",
    a: "Refunds for unused Blue Credits are handled on a case-by-case basis. Please contact support for assistance."
  },
];

export default function BlueProPage() {
  const { user } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (!user) {
      sessionStorage.setItem("redirectAfterLogin", "/blue-pro/checkout?pack=starter");
      router.push("/console");
      return;
    }
    router.push("/blue-pro/checkout?pack=starter");
  };

  return (
    <PageLayout>
      <div className="fixed inset-0 pointer-events-none">
<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
      </div>

      <section className="relative overflow-hidden pt-20 pb-16">
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand/10 border border-brand/30 text-brand text-xs font-semibold mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
              Blue Pro
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Pay As You Code
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                Only for What You Use
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Start with a renewable ₹100 paid trial for selected paid models, or choose the ₹1,500 full-access pack. Credits never expire.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="p-6 rounded-lg panel border border-line text-center">
              <div className="w-12 h-12 rounded-lg bg-brand/10 border border-line flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-cart-shopping text-brand"></i>
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">₹100 Trial Pack</h3>
              <p className="text-sm text-ink-muted">Get 1 Blue Credit for selected paid models. No expiry; purchase it again after using the credit.</p>
            </div>
            <div className="p-6 rounded-lg panel border border-line text-center">
              <div className="w-12 h-12 rounded-lg bg-brand/10 border border-line flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-microchip text-brand"></i>
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">₹1,500 Full Pack</h3>
              <p className="text-sm text-ink-muted">Get 15 Blue Credits and access the full Blue Pro model catalog.</p>
            </div>
            <div className="p-6 rounded-lg panel border border-line text-center">
              <div className="w-12 h-12 rounded-lg bg-brand/10 border border-line flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-infinity text-brand"></i>
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">Never Expire</h3>
              <p className="text-sm text-ink-muted">Credits stay in your wallet until you use them. No monthly resets.</p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand font-bold text-white shadow-lg shadow-sm transition duration-200 text-base"
            >
              <><i className="fa-solid fa-cart-plus"></i> Choose ₹100 Trial or Add Credits</>
            </button>
            <p className="text-xs text-ink-faint mt-3">Blue Pro activates only after a successful payment.</p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              <span className="text-ink">
                Model Pricing in Blue Credits
              </span>
            </h2>
            <p className="mt-4 text-ink-muted max-w-2xl mx-auto">
              Each model shows its cost in Blue Credits per one million tokens (input and output).
              Lower cost models are ideal for everyday tasks; premium models deliver maximum intelligence.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {tiers.map((tier) => (
              <div key={tier.name} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${tier.color} bg-clip-text text-transparent text-xs font-bold border border-line`}>
                <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${tier.color}`}></span>
                {tier.name}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg panel border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-4 px-6 text-ink-muted font-semibold text-xs uppercase tracking-wider">Model</th>
                  <th className="text-right py-4 px-6 text-ink-muted font-semibold text-xs uppercase tracking-wider">Input / 1M tokens</th>
                  <th className="text-right py-4 px-6 text-ink-muted font-semibold text-xs uppercase tracking-wider">Output / 1M tokens</th>
                  <th className="text-right py-4 px-6 text-ink-muted font-semibold text-xs uppercase tracking-wider">Tier</th>
                </tr>
              </thead>
              <tbody>
                {modelPricing.map((m, i) => (
                  <tr key={i} className="border-b border-line hover:bg-paper-alt transition">
                    <td className="py-4 px-6 text-ink font-semibold">{m.model}</td>
                    <td className="py-4 px-6 text-right font-mono text-ink-muted">{m.inputCredits}</td>
                    <td className="py-4 px-6 text-right font-mono text-ink-muted">{m.outputCredits}</td>
                    <td className="py-4 px-6 text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        m.tier === "Low Cost" ? "bg-green-950/60 text-green-400 border border-green-900/60" :
                        m.tier === "Standard" ? "bg-brand/10 text-brand border border-brand/30" :
                        m.tier === "High Cost" ? "bg-yellow-950/60 text-yellow-400 border border-yellow-900/60" :
                        "bg-brand/10 text-brand border border-brand/30"
                      }`}>{m.tier}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {tiers.map((tier) => (
              <div key={tier.name} className="p-4 rounded-lg panel border border-line">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${tier.color}`}></span>
                  <h4 className="text-sm font-bold text-ink">{tier.name}</h4>
                </div>
                <p className="text-xs text-ink-muted">{tier.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-brand/10 border border-line text-center">
            <p className="text-xs text-brand">
              Blue Credits consumed = measured model usage × applicable rate. Rates reflect model inference cost and platform services.
              Actual consumption per request depends on token count, caching, reasoning, and tool usage.
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden pb-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              <span className="text-ink">
                Frequently Asked Questions
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-lg panel border border-line overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer text-sm font-semibold text-ink hover:text-brand transition list-none">
                  {faq.q}
                  <i className="fa-solid fa-chevron-down text-ink-faint group-open:rotate-180 transition-transform"></i>
                </summary>
                <div className="px-5 pb-5 text-sm text-ink-muted leading-relaxed border-t border-line pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-ink-faint mb-4">Ready to get started?</p>
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand font-bold text-white shadow-lg shadow-sm transition duration-200 text-base"
            >
              <><i className="fa-solid fa-cart-plus"></i> Choose ₹100 Trial or Add Credits</>
            </button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
