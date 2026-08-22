import PageLayout from "@/app/components/PageLayout";

const roles = [
  {
    title: "LLM Infrastructure Programmer",
    description: "Optimize streaming latency, load-balancing gateway architectures, and payment integrations.",
    icon: "fa-server",
    gradient: "from-brand to-brand",
  },
  {
    title: "UI/UX Product Designer",
    description: "Build stunning developer tools, dashboard consoles, and interactive sidebar experiences.",
    icon: "fa-pen-ruler",
    gradient: "from-brand to-brand",
  },
  {
    title: "Compiler Integration Engineer",
    description: "Build language servers, autocomplete indexes, and type-checking engine components.",
    icon: "fa-cubes",
    gradient: "from-brand to-brand",
  },
];

export default function CareersPage() {
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
              Careers
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Help us build the
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                future of coding
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              We are a remote-first team of applied researchers and engineers building agentic IDE tools.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-ink mb-8 text-center">Open Roles</h2>
            <div className="space-y-4">
              {roles.map((role) => (
                <div
                  key={role.title}
                  className="p-6 rounded-lg panel border border-line hover:border-line-strong hover:bg-paper-alt transition duration-300 flex items-start gap-5 cursor-pointer group"
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${role.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                    <i className={`fa-solid ${role.icon} text-lg text-white`}></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-ink group-hover:text-brand transition mb-2">{role.title}</h3>
                    <p className="text-sm text-ink-muted leading-relaxed">{role.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-brand text-sm font-semibold shrink-0 opacity-0 group-hover:opacity-100 transition">
                    Apply <i className="fa-solid fa-arrow-right text-xs"></i>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
