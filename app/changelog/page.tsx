import PageLayout from "@/app/components/PageLayout";

const releases = [
  {
    version: "v0.5.7",
    tag: "Latest",
    tagColor: "from-blue-600 to-indigo-600",
    date: "Recent",
    changes: [
      {
        title: "Searchable Model Modal",
        description: "Replaced the standard dropdown menu with a sleek, searchable glassmorphic popup modal to manage 49+ models.",
        icon: "fa-magnifying-glass",
        gradient: "from-blue-500 to-cyan-500",
      },
      {
        title: "Smart 402 Error Formatting",
        description: "Reworked error handlers to cleanly display payment errors with top-up links instead of generic authentication failures.",
        icon: "fa-triangle-exclamation",
        gradient: "from-indigo-500 to-purple-500",
      },
      {
        title: "Automatic Wallet Creation",
        description: "Users now automatically receive a $1.00 starting wallet upon login.",
        icon: "fa-wallet",
        gradient: "from-green-500 to-teal-500",
      },
    ],
  },
];

export default function ChangelogPage() {
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
              Updates
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                What&apos;s New
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                in Blue
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Track our latest updates, improvements, and releases.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto space-y-10">
            {releases.map((release) => (
              <div key={release.version} className="rounded-2xl glass border border-gray-800/80 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-900/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-gray-100">{release.version}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r ${release.tagColor}`}>
                      {release.tag}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{release.date}</span>
                </div>
                <div className="p-6 space-y-5">
                  {release.changes.map((change) => (
                    <div key={change.title} className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${change.gradient} flex items-center justify-center shrink-0`}>
                        <i className={`fa-solid ${change.icon} text-sm text-white`}></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-100">{change.title}</h3>
                        <p className="text-sm text-gray-400 mt-1">{change.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
