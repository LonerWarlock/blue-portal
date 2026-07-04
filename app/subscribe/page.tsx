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
    features: [true, true, true, true, true, true, false, false, false, false, false],
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
    href: "https://core2cover.in/checkout/blue",
    cta: "Subscribe Now",
    description: "Advanced integrations and orchestration with Free/BYOK models.",
    features: [true, true, true, true, true, true, true, true, true, true, false],
    featured: true,
  },
  {
    name: "Blue Pro",
    subtitle: "Coming soon",
    price: "—",
    period: "",
    gradient: "from-purple-500 to-pink-500",
    badge: "Coming Soon",
    badgeStyle: "bg-gradient-to-r from-purple-600 to-pink-600",
    href: "#",
    cta: "Notify Me",
    description: "Infinite extensibility with premium reasoning models.",
    features: [true, true, true, true, true, true, true, true, true, true, true],
    featured: false,
    disabled: true,
  },
];

export default function SubscribePage() {
  return (
    <>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[160px]"></div>
      </div>

      <section className="relative min-h-screen flex items-center py-20">
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
              Start with Blue Lite for free. Upgrade to Blue for full access.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative p-8 rounded-2xl border transition-all duration-300 flex flex-col ${
                  plan.featured
                    ? "glass border-blue-500/40 shadow-xl shadow-blue-500/10"
                    : "glass border-gray-800/80 hover:border-gray-700/80"
                } ${plan.disabled ? "opacity-70" : ""}`}
              >
                {plan.badge && (
                  <span
                    className={`absolute -top-2.5 right-4 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-lg ${plan.badgeStyle}`}
                  >
                    {plan.badge}
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

                {plan.disabled ? (
                  <button
                    disabled
                    className="w-full px-6 py-3 rounded-xl bg-gray-800/50 text-gray-500 font-semibold cursor-not-allowed border border-gray-800/50 text-base mt-6"
                  >
                    <i className="fa-solid fa-clock mr-2"></i>
                    {plan.cta}
                  </button>
                ) : plan.name === "Blue Lite" ? (
                  <Link
                    href={plan.href}
                    className="inline-flex w-full items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 font-semibold text-white shadow-lg shadow-green-500/20 hover:from-green-500 hover:to-teal-500 transition duration-200 text-base"
                  >
                    <i className="fa-solid fa-check mr-2"></i>
                    {plan.cta}
                  </Link>
                ) : (
                  <a
                    href={plan.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-base"
                  >
                    <i className="fa-solid fa-arrow-right mr-2"></i>
                    {plan.cta}
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="mt-16 text-center max-w-2xl mx-auto p-6 rounded-2xl glass border border-gray-800/80">
            <div className="flex items-center justify-center gap-3 mb-3">
              <i className="fa-solid fa-shield-halved text-blue-400 text-lg"></i>
              <span className="text-sm text-gray-400">
                Secured by <span className="text-blue-400 font-semibold">Razorpay</span>
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Your payment information is processed securely by Razorpay. We never store your card details.
              After successful payment, you will be redirected back to Blue AI with your new plan activated.
            </p>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-600">
              All plans are in INR (₹). Prices include applicable taxes.
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
    </>
  );
}
