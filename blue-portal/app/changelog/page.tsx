import PageLayout from "@/app/components/PageLayout";

const releases = [
  {
    version: "v0.5.7",
    tag: "Latest",
    tagColor: "from-brand to-brand",
    date: "Recent",
    changes: [
      {
        title: "Searchable Model Modal",
        description: "Replaced the standard dropdown menu with a sleek, searchable glassmorphic popup modal to manage 49+ models.",
        icon: "fa-magnifying-panel",
        gradient: "from-brand to-brand",
      },
      {
        title: "Smart 402 Error Formatting",
        description: "Reworked error handlers to cleanly display payment errors with top-up links instead of generic authentication failures.",
        icon: "fa-triangle-exclamation",
        gradient: "from-brand to-brand",
      },
      {
        title: "Automatic Wallet Creation",
        description: "Users now automatically receive a $1.00 starting wallet upon login.",
        icon: "fa-wallet",
        gradient: "from-brand to-brand",
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
              Updates
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                What&apos;s New
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                in Blue
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Track our latest updates, improvements, and releases.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto space-y-10">
            {releases.map((release) => (
              <div key={release.version} className="rounded-lg panel border border-line overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper-alt">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-ink">{release.version}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r ${release.tagColor}`}>
                      {release.tag}
                    </span>
                  </div>
                  <span className="text-xs text-ink-faint">{release.date}</span>
                </div>
                <div className="p-6 space-y-5">
                  {release.changes.map((change) => (
                    <div key={change.title} className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${change.gradient} flex items-center justify-center shrink-0`}>
                        <i className={`fa-solid ${change.icon} text-sm text-white`}></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-ink">{change.title}</h3>
                        <p className="text-sm text-ink-muted mt-1">{change.description}</p>
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
