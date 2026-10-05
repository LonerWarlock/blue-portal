import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";
import { BLUE_SUBSCRIPTION_PLANS } from "@/lib/blueSubscriptionPlans";

const services = [
  {
    number: "01",
    title: "AI Coding Agent",
    description: "An autonomous AI coding agent that integrates directly into your development workflow. Blue's agents plan, write, execute, test, and self-correct code autonomously without manual intervention.",
    capabilities: [
      "Autonomous Agent Loop — Plans, writes code, runs terminals, and self-corrects in a continuous four-stage cycle.",
      "Codebase Understanding — Full project indexing for context-aware generation that respects existing patterns and conventions.",
      "Multi-Agent Teams — Bounded background loops with specialised sub-agents (Explorer, Architect, Reviewer, Verifier) coordinating on complex tasks. Available in the Blue plan.",
      "Self-Correction Engine — Independently reviews diffs, detects runtime errors, and iteratively refines output.",
    ],
  },
  {
    number: "02",
    title: "Model Gateway & Catalogue",
    description: "Choose supported models through your own provider connection or eligible Blue Pro model access. Model availability, usage prices, and limits depend on that connection.",
    capabilities: [
      "Multi-Model Access — Choose from the supported models shown for your provider and account.",
      "Free Models — Provider models marked free may have rate limits and availability restrictions.",
      "Separate Model Billing — BYOK usage is billed by your provider where applicable and does not spend Blue Credits. Blue Pro model usage uses Blue Credits.",
      "Local Model Support — Connect local Ollama models for zero-cost inference with no data leaving your network.",
    ],
  },
  {
    number: "03",
    title: "VS Code Extension",
    description: "The primary delivery interface — a VS Code extension that brings all Blue AI capabilities directly into your editor.",
    capabilities: [
      "Inline Autocomplete — Real-time tab completions with Fill-in-the-Middle context that adapts to your codebase style.",
      "Sidebar Chat — Interactive multi-turn chat supporting code context injection, file references, and apply-to-editor workflows.",
      "Codebase Tools — Ripgrep-powered search, file listing, file reading, and single-file editing accessible from chat.",
      "Syntax Verification — Automatic background linting of generated code blocks to prevent compile errors.",
    ],
  },
  {
    number: "04",
    title: "Developer Console",
    description: "A web-based console for managing your account, API keys, wallet, and model access.",
    capabilities: [
      "Blue Credits Wallet — Manage prepaid Blue Pro credits and available top-up packs. Blue Credits do not expire; they are separate from Blue subscription access and BYOK provider billing.",
      "API Key Management — Generate, rotate, and revoke keys. Monitor per-key usage with optional spending limits.",
      "Model Catalogue — Browse supported models, their displayed pricing, and availability for your connection.",
      "Usage Analytics — Track token consumption, request volume, and spending across models and time periods.",
    ],
  },
  {
    number: "05",
    title: "Subscription Plans",
    description: "Tiered plans that unlock additional capabilities beyond the free tier.",
    capabilities: [
      "Blue Lite (Free, ₹0) — Entry-level coding app features. Provider usage costs and limits remain separate.",
      `Blue — Prepaid app access: ₹${BLUE_SUBSCRIPTION_PLANS.monthly.priceInr} for ${BLUE_SUBSCRIPTION_PLANS.monthly.days} days, ₹${BLUE_SUBSCRIPTION_PLANS.quarterly.priceInr} for ${BLUE_SUBSCRIPTION_PLANS.quarterly.days} days, or ₹${BLUE_SUBSCRIPTION_PLANS.yearly.priceInr.toLocaleString("en-IN")} for ${BLUE_SUBSCRIPTION_PLANS.yearly.days} days. No auto-renewal; Blue Pro credits are not included.`,
      "Blue Pro — Eligible premium model access paid through Blue Credits, with app features available according to your account. Not unlimited free inference.",
    ],
  },
  {
    number: "06",
    title: "Enterprise Solutions",
    description: "Infrastructure for organisations requiring self-hosted deployment, compliance controls, and team management.",
    capabilities: [
      "Self-Hosted Gateways — Deploy the Blue API gateway within your private VPC. All model requests route through your infrastructure.",
      "Single Sign-On — Integration with Okta, Azure Active Directory, and Google Workspace for unified authentication.",
      "No Training Guarantee — Contractual guarantee that your code and outputs are never used to train AI models.",
      "Unified Team Budgets — Centralised billing with per-key credit limits and organisation-wide usage monitoring.",
    ],
  },
  {
    number: "07",
    title: "Security & Compliance",
    description: "Security architecture designed to protect proprietary source code at every layer of the stack.",
    capabilities: [
      "Zero Data Retention — Code segments are used only to complete the current query and are never stored on gateway servers.",
      "No Model Training — None of your code inputs, prompts, or outputs are shared with third-party providers for training LLM weights.",
      "Local Execution — All sandboxed commands execute on your local host. Code never leaves your machine.",
      "Encryption — End-to-end encryption for all data in transit and at rest. API keys are hashed before storage.",
    ],
  },
  {
    number: "08",
    title: "Support & Community",
    description: "Multiple channels for documentation, technical support, and community engagement.",
    capabilities: [
      "Documentation — Step-by-step guides for VS Code extension installation, gateway configuration, API key generation, and model selection.",
      "Community — Real-time discussion on Discord, feature requests on GitHub Discussions, and community forums for knowledge sharing.",
      "System Status — Live monitoring of API Gateway, Authentication, Completions Proxy, Dynamic Models Router, and Upstream Proxy.",
      "Contact — Direct contact form with company address in Sangli, Maharashtra. Co-founder LinkedIn profiles for escalation.",
    ],
  },
];

export default function ServicesPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
              Services
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Blue AI
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                Service Documentation
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              An overview of Blue by Imergene. App access and AI model usage are separate; see <Link href="/about#billing" className="text-brand hover:underline">the official product and billing facts</Link> and <Link href="/pricing" className="text-brand hover:underline">current pricing</Link>.
            </p>
          </div>

          <div className="mt-20 space-y-16">
            {services.map((service) => (
              <section key={service.number} className="scroll-mt-24">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl font-bold text-ink-faint/60 select-none">{service.number}</span>
                  <h2 className="text-2xl font-bold text-ink">{service.title}</h2>
                </div>
                <p className="text-ink-muted leading-relaxed ml-16 mb-6">{service.description}</p>
                <ul className="ml-16 space-y-3">
                  {service.capabilities.map((cap, i) => (
                    <li key={i} className="text-sm text-ink-muted leading-relaxed">{cap}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-20 pt-8 border-t border-line text-center">
            <p className="text-xs text-ink-faint">
              Owned and operated by IMERGENE. Registered in Sangli, Maharashtra, India.
            </p>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
