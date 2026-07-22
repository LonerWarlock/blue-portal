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
  { name: "Low Cost", color: "from-green-500 to-emerald-500", description: "Everyday coding tasks, autocomplete, quick fixes" },
  { name: "Standard", color: "from-blue-500 to-indigo-500", description: "Complex reasoning, refactoring, multi-file edits" },
  { name: "High Cost", color: "from-yellow-500 to-orange-500", description: "Advanced agentic workflows, deep research" },
  { name: "Premium", color: "from-purple-500 to-pink-500", description: "Maximum intelligence, flagship models" },
];

const faqs = [
  {
    q: "What are Blue Credits?",
    a: "Blue Credits are service-usage units for Blue's pay-as-you-go models. The renewable Starter pack costs ₹96 for 1 Blue Credit and the Full pack costs ₹1,440 for 15 Blue Credits. There is no time limit."
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
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[128px]"></div>
      </div>

      <section className="relative overflow-hidden pt-20 pb-16">
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/40 border border-purple-800/50 text-purple-400 text-xs font-semibold mb-8">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              Blue Pro
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Pay As You Code
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
                Only for What You Use
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Start with a renewable ₹96 paid trial for selected paid models, or choose the ₹1,440 full-access pack. Credits never expire.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="p-6 rounded-2xl glass border border-gray-800/80 text-center">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-cart-shopping text-purple-400"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-2">₹96 Trial Pack</h3>
              <p className="text-sm text-gray-400">Get 1 Blue Credit for selected paid models. No expiry; purchase it again after using the credit.</p>
            </div>
            <div className="p-6 rounded-2xl glass border border-gray-800/80 text-center">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-microchip text-purple-400"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-2">₹1,440 Full Pack</h3>
              <p className="text-sm text-gray-400">Get 15 Blue Credits and access the full Blue Pro model catalog.</p>
            </div>
            <div className="p-6 rounded-2xl glass border border-gray-800/80 text-center">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-infinity text-purple-400"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-2">Never Expire</h3>
              <p className="text-sm text-gray-400">Credits stay in your wallet until you use them. No monthly resets.</p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition duration-200 text-base"
            >
              <><i className="fa-solid fa-cart-plus"></i> Choose ₹96 Trial or Add Credits</>
            </button>
            <p className="text-xs text-gray-500 mt-3">Blue Pro activates only after a successful payment.</p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Model Pricing in Blue Credits
              </span>
            </h2>
            <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
              Each model shows its cost in Blue Credits per one million tokens (input and output).
              Lower cost models are ideal for everyday tasks; premium models deliver maximum intelligence.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {tiers.map((tier) => (
              <div key={tier.name} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${tier.color} bg-clip-text text-transparent text-xs font-bold border border-gray-800/80`}>
                <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${tier.color}`}></span>
                {tier.name}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl glass border border-gray-800/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/80">
                  <th className="text-left py-4 px-6 text-gray-400 font-semibold text-xs uppercase tracking-wider">Model</th>
                  <th className="text-right py-4 px-6 text-gray-400 font-semibold text-xs uppercase tracking-wider">Input / 1M tokens</th>
                  <th className="text-right py-4 px-6 text-gray-400 font-semibold text-xs uppercase tracking-wider">Output / 1M tokens</th>
                  <th className="text-right py-4 px-6 text-gray-400 font-semibold text-xs uppercase tracking-wider">Tier</th>
                </tr>
              </thead>
              <tbody>
                {modelPricing.map((m, i) => (
                  <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-900/30 transition">
                    <td className="py-4 px-6 text-gray-200 font-semibold">{m.model}</td>
                    <td className="py-4 px-6 text-right font-mono text-gray-300">{m.inputCredits}</td>
                    <td className="py-4 px-6 text-right font-mono text-gray-300">{m.outputCredits}</td>
                    <td className="py-4 px-6 text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        m.tier === "Low Cost" ? "bg-green-950/60 text-green-400 border border-green-900/60" :
                        m.tier === "Standard" ? "bg-blue-950/60 text-blue-400 border border-blue-900/60" :
                        m.tier === "High Cost" ? "bg-yellow-950/60 text-yellow-400 border border-yellow-900/60" :
                        "bg-purple-950/60 text-purple-400 border border-purple-900/60"
                      }`}>{m.tier}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {tiers.map((tier) => (
              <div key={tier.name} className="p-4 rounded-xl glass border border-gray-800/80">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${tier.color}`}></span>
                  <h4 className="text-sm font-bold text-gray-200">{tier.name}</h4>
                </div>
                <p className="text-xs text-gray-400">{tier.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 text-center">
            <p className="text-xs text-blue-300">
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
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Frequently Asked Questions
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl glass border border-gray-800/80 overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer text-sm font-semibold text-gray-200 hover:text-white transition list-none">
                  {faq.q}
                  <i className="fa-solid fa-chevron-down text-gray-500 group-open:rotate-180 transition-transform"></i>
                </summary>
                <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed border-t border-gray-800/60 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500 mb-4">Ready to get started?</p>
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition duration-200 text-base"
            >
              <><i className="fa-solid fa-cart-plus"></i> Choose ₹96 Trial or Add Credits</>
            </button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
