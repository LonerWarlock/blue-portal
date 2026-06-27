import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const steps = [
  {
    number: "1",
    title: "Install",
    description: 'Install the <span class="text-blue-400">Blue Coding Assistant</span> extension from the VS Code Marketplace.',
    icon: "fa-download",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    number: "2",
    title: "Set Gateway",
    description: 'Open settings <span class="text-gray-300">(Ctrl + ,)</span> and set <span class="text-green-400 font-mono text-xs">blueCodingAssistant.gatewayUrl</span> to: <div class="mt-2 p-2 rounded-lg bg-gray-950 border border-gray-800 text-green-400 font-mono text-xs">https://blue-by-imergene.vercel.app/api</div>',
    icon: "fa-gear",
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    number: "3",
    title: "Get Key",
    description: "Go to the console dashboard, copy your API key, and paste it into the extension sidebar.",
    icon: "fa-key",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    number: "4",
    title: "Choose Model",
    description: "Click the model selector badge in the sidebar to open the searchable modal, search, and click to activate a model.",
    icon: "fa-microchip",
    gradient: "from-green-500 to-teal-500",
  },
];

export default function DocsPage() {
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
              Documentation
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Developer Guides &amp;
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                API Reference
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Learn how to configure, connect, and customize the Blue Coding Assistant.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-gray-100 mb-8 text-center">Setup Guide</h2>
            <div className="space-y-6">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="p-6 rounded-2xl glass border border-gray-800/80 hover:border-gray-700/80 transition duration-300 flex items-start gap-5"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                    <i className={`fa-solid ${step.icon} text-lg text-white`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center text-xs font-bold text-white`}>
                        {step.number}
                      </span>
                      <h3 className="text-lg font-bold text-gray-100">{step.title}</h3>
                    </div>
                    <div className="text-sm text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: step.description }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/console"
              className="inline-flex px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200 text-base"
            >
              Open Console
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
