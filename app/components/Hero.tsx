import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-32">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-semibold mb-8">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Now with GPT 5.5, Claude Fable 5 & Gemini 3.5 Flash
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              Your AI coding agent
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              for building ambitious software.
            </span>
          </h1>

          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Blue is an applied research team focused on building the future of software development.
            Accelerate development by handing off tasks to Blue while you focus on architecture and decisions.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/console"
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-base"
            >
              Get Started
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
            <Link
              href="/docs"
              className="px-8 py-3.5 rounded-xl border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition duration-200 text-base"
            >
              Read the Docs
              <i className="fa-solid fa-book ml-2"></i>
            </Link>
          </div>
        </div>

        {/* Demo Terminal Mockup */}
        <div className="mt-20 max-w-5xl mx-auto">
          <div className="rounded-2xl glass border border-gray-800/80 overflow-hidden shadow-2xl">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800/80 bg-gray-900/50">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="text-xs text-gray-500 ml-3 font-mono">blue-agent ~/project</span>
              <div className="ml-auto flex items-center gap-3 text-gray-600">
                <i className="fa-solid fa-bolt text-xs"></i>
                <span className="text-[10px] font-mono">GPT-5.5</span>
              </div>
            </div>

            {/* Terminal content */}
            <div className="p-6 font-mono text-sm space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-green-400 shrink-0">$</span>
                <span className="text-gray-300">Build a real-time dashboard with WebSocket data pipeline</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-400 shrink-0">{'>'}</span>
                <span className="text-gray-400">Analyzing project structure... Found 284 files across 37 directories</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-400 shrink-0">{'>'}</span>
                <span className="text-gray-400">Indexing codebase... Understanding dependencies and data flow</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-purple-400 shrink-0">{'\u2192'}</span>
                <span className="text-gray-200">Planning implementation: Dashboard layout → WebSocket client → Real-time charts → API integration</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-400 shrink-0">{'>'}</span>
                <span className="text-gray-400">Writing server/websocket.ts...</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-400 shrink-0">{'>'}</span>
                <span className="text-gray-400">Writing components/LiveChart.tsx...</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-400 shrink-0">✓</span>
                <span className="text-green-400">Build complete. 3 files created, 12 modified. Ready for review.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
