import PageLayout from "@/app/components/PageLayout";

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
    description: "A unified API gateway providing access to 49 AI models across six families, with pay-as-you-go token pricing and a free tier that never costs money.",
    capabilities: [
      "Multi-Model Access — 49 models across Free Tier, Claude, GPT, Gemini, and Specialist families.",
      "Free Tier — Six models at $0.00 per million tokens. Unlimited free usage within daily rate limits.",
      "Pay-As-You-Go Pricing — Per-million-token rates: Claude ($3.00 in / $15.00 out), GPT ($2.50 in / $10.00 out), Gemini ($1.25 in / $5.00 out).",
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
      "Wallet Management — Prepaid system with $1.00 free starter credits. Refill in increments of $5, $10, or $20 via Stripe. Credits never expire.",
      "API Key Management — Generate, rotate, and revoke keys. Monitor per-key usage with optional spending limits.",
      "Model Catalogue — Browse all 49 models with search, filter, real-time pricing, context windows, and rate limits.",
      "Usage Analytics — Track token consumption, request volume, and spending across models and time periods.",
    ],
  },
  {
    number: "05",
    title: "Subscription Plans",
    description: "Tiered plans that unlock additional capabilities beyond the free tier.",
    capabilities: [
      "Blue Lite (Free, ₹0) — AI Chat, Code Autocomplete, Codebase Search, Syntax Checking, Cloud Models (100 req/day), Local Models.",
      "Blue (₹149/month) — All Lite features plus Multi-Agent Teams, Figma-to-Code, GitHub Integration, Web Search, 1,000 req/day, API Key Access.",
      "Blue Pro (Coming Soon) — All Blue features plus built-in Premium Models, MCP Server support, Plugin System, Enterprise workspace orchestration, unlimited requests, and Team Management.",
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
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-semibold mb-8">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Services
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Blue AI
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Service Documentation
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              A comprehensive overview of every service, capability, and offering provided by the Blue AI platform.
            </p>
          </div>

          <div className="mt-20 space-y-16">
            {services.map((service) => (
              <section key={service.number} className="scroll-mt-24">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl font-bold text-gray-800/60 select-none">{service.number}</span>
                  <h2 className="text-2xl font-bold text-gray-100">{service.title}</h2>
                </div>
                <p className="text-gray-400 leading-relaxed ml-16 mb-6">{service.description}</p>
                <ul className="ml-16 space-y-3">
                  {service.capabilities.map((cap, i) => (
                    <li key={i} className="text-sm text-gray-400 leading-relaxed">{cap}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-20 pt-8 border-t border-gray-800/60 text-center">
            <p className="text-xs text-gray-600">
              Owned and operated by IMERGENE. Registered in Sangli, Maharashtra, India.
            </p>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
