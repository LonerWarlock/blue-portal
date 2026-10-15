import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const pillars = [
  {
    title: "Understand Data Storage",
    description: "Blue Desktop can retain conversations locally, and its coding engine can keep separate history. Cloud gateways and model providers apply their own retention terms; there is no universal zero-retention guarantee.",
    icon: "fa-trash-can",
    gradient: "from-brand to-brand",
  },
  {
    title: "Know Your AI Provider",
    description: "Your selected cloud model can receive prompts, code, and connector results needed for a request. Review that provider's privacy and data-use terms before sending sensitive content.",
    icon: "fa-microchip",
    gradient: "from-brand to-brand",
  },
  {
    title: "Local Execution",
    description: "Desktop project commands run on your computer under the applicable permission settings. Local command execution does not make cloud-model processing local.",
    icon: "fa-house-laptop",
    gradient: "from-brand to-brand",
  },
];

export default function SecurityPage() {
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
              Security
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Security &amp;
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                Data Handling
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Understand where Blue processes information, what it stores, and which controls apply to your chosen connection.
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="p-6 rounded-lg panel border border-line hover:border-line-strong transition duration-300"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${pillar.gradient} flex items-center justify-center mb-5`}>
                  <i className={`fa-solid ${pillar.icon} text-lg text-white`}></i>
                </div>
                <h3 className="text-lg font-bold text-ink mb-3">{pillar.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 max-w-5xl mx-auto rounded-lg border border-line bg-paper-alt p-6 text-sm text-ink-muted leading-relaxed space-y-3">
            <h2 className="text-lg font-semibold text-ink">Google Workspace in Blue Desktop</h2>
            <p>Google API calls use HTTPS, and OAuth credentials are stored in the encrypted local credential store. Ordinary conversation state is not encrypted by that credential-store mechanism. Content retrieved from Google can be sent to your selected AI engine, gateway, and model provider; this is not end-to-end encryption from those services.</p>
            <p>Google changes require action approval. Disconnecting removes locally saved Google credentials, but does not revoke Google-side access or erase existing conversation and provider history. Read the <Link href="/privacy#google-workspace" className="text-brand hover:underline">Google Workspace privacy notice</Link> for supported actions and steps to revoke access or request deletion.</p>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/console"
              className="inline-flex px-8 py-3.5 rounded-lg bg-brand font-semibold text-white shadow-lg transition duration-200 text-base"
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
