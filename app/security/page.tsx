import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const pillars = [
  {
    title: "Zero Data Retention",
    description: "Your code segments are only used to complete the current query and are never stored on our gateway servers.",
    icon: "fa-trash-can",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "No Model Training",
    description: "None of your code inputs are shared with third-party providers for training LLM weights.",
    icon: "fa-microchip",
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    title: "Local Execution",
    description: "Sandboxed commands execute on your local host, keeping execution completely in your control.",
    icon: "fa-house-laptop",
    gradient: "from-green-500 to-teal-500",
  },
];

export default function SecurityPage() {
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
              Security
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Enterprise-Grade
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Security Standards
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Your proprietary source code is protected by end-to-end encryption.
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="p-6 rounded-2xl glass border border-gray-800/80 hover:border-gray-700/80 transition duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center mb-5`}>
                  <i className={`fa-solid ${pillar.icon} text-lg text-white`}></i>
                </div>
                <h3 className="text-lg font-bold text-gray-100 mb-3">{pillar.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{pillar.description}</p>
              </div>
            ))}
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
