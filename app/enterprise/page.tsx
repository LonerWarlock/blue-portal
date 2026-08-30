import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const pillars = [
  {
    icon: "fa-server",
    title: "Self-Hosted Gateways",
    description: "Deploy the Blue Gateway inside your own corporate cloud or private VPC.",
    gradient: "from-brand to-brand",
  },
  {
    icon: "fa-user-lock",
    title: "Single Sign-On (SSO)",
    description: "Connect your team access via Okta, Microsoft Azure, or Google Workspace.",
    gradient: "from-brand to-brand",
  },
  {
    icon: "fa-database",
    title: "No Training Guarantee",
    description: "Ensure that none of your company's proprietary code is sent to public AI training pools.",
    gradient: "from-brand to-brand",
  },
  {
    icon: "fa-credit-card",
    title: "Unified Team Budgets",
    description: "Assign credit limits to specific developer API keys, avoiding unexpected LLM bills.",
    gradient: "from-brand to-brand",
  },
];

export default function EnterprisePage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
<div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
              Enterprise
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Secure AI for
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                high-velocity teams
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Bring Blue to your organization with corporate-grade security, custom model routing, and unified billing.
            </p>
          </div>

          <div className="mt-20 max-w-5xl mx-auto">
            <div className="rounded-lg panel border border-line p-8">
              <p className="text-ink-muted leading-relaxed mb-8">
                Blue Enterprise is designed for software teams that need speed without sacrificing data privacy.
              </p>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
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
