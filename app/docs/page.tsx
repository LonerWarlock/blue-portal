import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const steps = [
  {
    number: "1",
    title: "Install",
    description: 'Install the <span class="text-brand">Blue Coding Assistant</span> extension from the VS Code Marketplace.',
    icon: "fa-download",
    gradient: "from-brand to-brand",
  },
  {
    number: "2",
    title: "Set Gateway",
    description: 'Open settings <span class="text-ink-muted">(Ctrl + ,)</span> and set <span class="text-green-400 font-mono text-xs">blueCodingAssistant.gatewayUrl</span> to: <div class="mt-2 p-2 rounded-lg bg-paper border border-line text-green-400 font-mono text-xs">https://blue-by-imergene.vercel.app/api</div>',
    icon: "fa-gear",
    gradient: "from-brand to-brand",
  },
  {
    number: "3",
    title: "Get Key",
    description: "Go to the console dashboard, copy your API key, and paste it into the extension sidebar.",
    icon: "fa-key",
    gradient: "from-brand to-brand",
  },
  {
    number: "4",
    title: "Choose Model",
    description: "Click the model selector badge in the sidebar to open the searchable modal, search, and click to activate a model.",
    icon: "fa-microchip",
    gradient: "from-brand to-brand",
  },
];

export default function DocsPage() {
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
              Documentation
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Developer Guides &amp;
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                API Reference
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Learn how to configure, connect, and customize the Blue Coding Assistant.
            </p>
          </div>

          <div className="mt-20 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-ink mb-8 text-center">Setup Guide</h2>
            <div className="space-y-6">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="p-6 rounded-lg panel border border-line hover:border-line-strong transition duration-300 flex items-start gap-5"
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${step.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                    <i className={`fa-solid ${step.icon} text-lg text-white`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center text-xs font-bold text-white`}>
                        {step.number}
                      </span>
                      <h3 className="text-lg font-bold text-ink">{step.title}</h3>
                    </div>
                    <div className="text-sm text-ink-muted leading-relaxed" dangerouslySetInnerHTML={{ __html: step.description }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/console"
              className="inline-flex px-8 py-3.5 rounded-lg bg-brand font-semibold text-white shadow-lg transition duration-200 text-base"
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
