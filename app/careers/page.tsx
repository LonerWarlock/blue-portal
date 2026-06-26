import PageLayout from "@/app/components/PageLayout";

const roles = [
  {
    title: "LLM Infrastructure Programmer",
    description: "Optimize streaming latency, load-balancing gateway architectures, and payment integrations.",
    icon: "fa-server",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "UI/UX Product Designer",
    description: "Build stunning developer tools, dashboard consoles, and interactive sidebar experiences.",
    icon: "fa-pen-ruler",
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    title: "Compiler Integration Engineer",
    description: "Build language servers, autocomplete indexes, and type-checking engine components.",
    icon: "fa-cubes",
    gradient: "from-purple-500 to-pink-500",
  },
];

export default function CareersPage() {
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
              Careers
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Help us build the
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                future of coding
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              We are a remote-first team of applied researchers and engineers building agentic IDE tools.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-gray-100 mb-8 text-center">Open Roles</h2>
            <div className="space-y-4">
              {roles.map((role) => (
                <div
                  key={role.title}
                  className="p-6 rounded-2xl glass border border-gray-800/80 hover:border-gray-700/80 hover:bg-gray-900/10 transition duration-300 flex items-start gap-5 cursor-pointer group"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                    <i className={`fa-solid ${role.icon} text-lg text-white`}></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-100 group-hover:text-blue-400 transition mb-2">{role.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{role.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold shrink-0 opacity-0 group-hover:opacity-100 transition">
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
