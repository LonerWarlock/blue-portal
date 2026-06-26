import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

export default function AgentsPage() {
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
              Product
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Let AI code for you
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                while you think
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Blue&apos;s Autonomous Agents don&apos;t just suggest code lines—they build entire features,
              run tests, and fix bugs by themselves.
            </p>
          </div>

          {/* Agent Loop Diagram */}
          <div className="mt-20 max-w-5xl mx-auto">
            <div className="rounded-2xl glass border border-gray-800/80 overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800/80 bg-gray-900/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="text-xs text-gray-500 ml-3 font-mono">blue-agent ~/project</span>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-950/20 border border-blue-900/30">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-list-check text-white"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-blue-300">1. Plans</h3>
                    <p className="text-sm text-gray-400 mt-1">Outlines all the file changes and new code blocks required to achieve the goal.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/30">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-code text-white"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-300">2. Writes Code</h3>
                    <p className="text-sm text-gray-400 mt-1">Creates and updates code files automatically in your workspace.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-purple-950/20 border border-purple-900/30">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-terminal text-white"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-purple-300">3. Runs Terminals</h3>
                    <p className="text-sm text-gray-400 mt-1">Runs compiling tasks, lint checks, and testing commands to ensure the code is correct.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-green-950/20 border border-green-900/30">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-rotate text-white"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-green-300">4. Self-Corrects</h3>
                    <p className="text-sm text-gray-400 mt-1">If a test fails, the agent reads the terminal output error, rewrites the code, and tests it again until it passes.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Callouts */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-2xl glass border border-gray-800/80">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-5">
                <i className="fa-solid fa-terminal text-lg text-white"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-3">Terminal Integration</h3>
              <p className="text-sm text-gray-400">Safe sandboxed terminal execution that runs locally on your machine.</p>
            </div>
            <div className="p-6 rounded-2xl glass border border-gray-800/80">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-5">
                <i className="fa-solid fa-eye text-lg text-white"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-3">Independent Review</h3>
              <p className="text-sm text-gray-400">Before finishing, the agent inspects the diff output to ensure no syntax errors are introduced.</p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/console"
              className="inline-flex px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-base"
            >
              Get Started
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
