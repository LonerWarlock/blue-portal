import Link from "next/link";
import TerminalCard3D from "./TerminalCard3D";
import VSCodeInstallSnippet from "./VSCodeInstallSnippet";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-32">
      {/* Farthest back: ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-semibold mb-8">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Autonomous Agents — Plan, Code, Test, Self-Correct
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              Let AI code for you
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              while you think
            </span>
          </h1>

          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Blue&apos;s Autonomous Agents don&apos;t just suggest code lines—they build entire features,
            run tests, and fix bugs by themselves.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link prefetch={false}
              href="/console"
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-base"
            >
              Get Started
              <i className="fa-solid fa-arrow-right ml-2" />
            </Link>
            <Link prefetch={false}
              href="/subscribe"
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition duration-200 text-base"
            >
              <i className="fa-solid fa-crown mr-2" />
              See Plans
            </Link>
            <Link prefetch={false}
              href="/docs"
              className="px-8 py-3.5 rounded-xl border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition duration-200 text-base"
            >
              <i className="fa-solid fa-book mr-2" />
              Docs
            </Link>
          </div>

          {/* Terminal Command Install Snippet */}
          <div className="mt-10">
            <VSCodeInstallSnippet />
          </div>
        </div>

        <div className="mt-20 max-w-5xl mx-auto">
          <TerminalCard3D />
        </div>
      </div>
    </section>
  );
}
