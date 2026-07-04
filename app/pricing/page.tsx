import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const pricingTiers = [
  {
    name: "Free Tier",
    input: "$0.00",
    output: "$0.00",
    models: "MiMo, DeepSeek Flash, Nemotron",
    gradient: "from-green-500 to-teal-500",
    badge: "Free",
  },
  {
    name: "Claude Tiers",
    input: "$3.00",
    output: "$15.00",
    models: "Claude 3.5 Sonnet",
    gradient: "from-blue-500 to-cyan-500",
    badge: "Popular",
  },
  {
    name: "GPT Tiers",
    input: "$2.50",
    output: "$10.00",
    models: "GPT-4o",
    gradient: "from-indigo-500 to-purple-500",
    badge: null,
  },
  {
    name: "Gemini Tiers",
    input: "$1.25",
    output: "$5.00",
    models: "Gemini 1.5 Pro",
    gradient: "from-purple-500 to-pink-500",
    badge: null,
  },
];

export default function PricingPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-semibold mb-8">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Pricing
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Simple, Pay-As-You-Go
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Pricing
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              No monthly subscription traps. Only pay for the exact tokens your AI consumes.
            </p>
          </div>

          <div className="mt-16 max-w-3xl mx-auto">
            <div className="rounded-2xl glass border border-gray-800/80 p-8 shadow-2xl mb-10">
              <h3 className="text-xl font-bold text-gray-100 mb-4">How it works</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                Blue uses a prepaid wallet system. You top up your account, and your queries consume tokens in real-time.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-gray-400">
                  <span className="w-6 h-6 rounded-full bg-green-950/60 border border-green-900/60 text-green-400 flex items-center justify-center shrink-0 text-xs">$</span>
                  <span><strong className="text-gray-200">Get Started Free:</strong> All new sign-ups receive $1.00 of free starter credits to query any model.</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-400">
                  <span className="w-6 h-6 rounded-full bg-blue-950/60 border border-blue-900/60 text-blue-400 flex items-center justify-center shrink-0 text-xs">
                    <i className="fa-solid fa-gem text-[8px]"></i>
                  </span>
                  <span><strong className="text-gray-200">Free Tier Models:</strong> You can switch to our free tier models (like DeepSeek V4 Flash or MiMo V2.5) at any time. These cost $0.00 and will never drain your wallet.</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-400">
                  <span className="w-6 h-6 rounded-full bg-purple-950/60 border border-purple-900/60 text-purple-400 flex items-center justify-center shrink-0 text-xs">
                    <i className="fa-solid fa-rotate text-[8px]"></i>
                  </span>
                  <span><strong className="text-gray-200">Prepaid Refills:</strong> Refill your wallet at any time in increments of $5, $10, or $20 using Stripe checkout. Your credits never expire.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Pricing Table */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className="p-6 rounded-2xl glass border border-gray-800/80 hover:border-gray-700/80 transition duration-300 relative"
              >
                {tier.badge && (
                  <span className={`absolute -top-2.5 right-4 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-lg ${
                    tier.badge === "Popular" ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-gradient-to-r from-green-600 to-teal-600"
                  }`}>
                    {tier.badge}
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center mb-4`}>
                  <i className="fa-solid fa-microchip text-sm text-white"></i>
                </div>
                <h3 className="text-lg font-bold text-gray-100 mb-3">{tier.name}</h3>
                <p className="text-xs text-gray-500 mb-4">{tier.models}</p>
                <div className="space-y-2 mt-4 pt-4 border-t border-gray-800/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Input</span>
                    <span className="text-gray-200 font-semibold">{tier.input}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Output</span>
                    <span className="text-gray-200 font-semibold">{tier.output}</span>
                  </div>
                  <div className="text-[10px] text-gray-600 text-right">per 1 Million Tokens</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center flex items-center justify-center gap-4">
            <Link
              href="/subscribe"
              className="inline-flex px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition duration-200 text-base"
            >
              <i className="fa-solid fa-crown mr-2"></i>
              Subscribe
            </Link>
            <Link
              href="/console"
              className="inline-flex px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-base"
            >
              Get Started Free
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
