import Link from "next/link";

export default function CtaSection() {
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-3xl glass border border-gray-800/80 p-12 md:p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-[128px]"></div>
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Try Blue now.
            </h2>
            <p className="mt-4 text-gray-400 max-w-xl mx-auto">
              Get started free — every new sign-up receives $1.00 of free starter credits. No credit card required.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/console"
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-base"
              >
                Get Started Free
                <i className="fa-solid fa-arrow-right ml-2"></i>
              </Link>
              <Link
                href="/docs"
                className="px-8 py-3.5 rounded-xl border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition duration-200 text-base"
              >
                View Documentation
              </Link>
            </div>
            <p className="mt-6 text-xs text-gray-600">
              Free tier models (DeepSeek V4 Flash, MiMo V2.5, Nemotron) cost $0.00 — they never drain your wallet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
