import PageLayout from "@/app/components/PageLayout";

export default function PrivacyPage() {
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
              Privacy
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Privacy
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Policy
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Clear, simple terms about what data we collect and how we protect it.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto">
            <div className="rounded-2xl glass border border-gray-800/80 p-8 md:p-12 shadow-2xl">
              <div className="space-y-10">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <i className="fa-solid fa-user text-sm text-white"></i>
                    </div>
                    <h2 className="text-lg font-bold text-gray-100">Account Data</h2>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed pl-[52px]">
                    We collect basic account details (like your email address) to manage logins and wallet balances.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <i className="fa-solid fa-chart-simple text-sm text-white"></i>
                    </div>
                    <h2 className="text-lg font-bold text-gray-100">Usage Data</h2>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed pl-[52px]">
                    We track token counts per query to log transactions in the audit ledger.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                      <i className="fa-solid fa-code text-sm text-white"></i>
                    </div>
                    <h2 className="text-lg font-bold text-gray-100">Code Privacy</h2>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed pl-[52px]">
                    We do not read, scan, or log your codebase files. Your code remains private to your machine.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
