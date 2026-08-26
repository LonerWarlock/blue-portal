import Link from "next/link";

const features = [
  {
    icon: "fa-microchip",
    title: "Multi-Model Architecture",
    description: "Choose between every cutting-edge model from OpenAI, Anthropic, Gemini, xAI, and open-source specialists. Use the best model for every task.",
  },
  {
    icon: "fa-code-branch",
    title: "Agentic Coding",
    description: "Blue Agents operate in a continuous loop — planning, writing code, running terminals, and self-correcting until every test passes. Hand off complex tasks while you focus on architecture.",
  },
  {
    icon: "fa-terminal",
    title: "Terminal Integration",
    description: "Safe sandboxed terminal execution that runs locally on your machine. Blue runs lint checks, compiles, and tests your code, then inspects the diff for syntax errors before finishing.",
  },
  {
    icon: "fa-sitemap",
    title: "Complete Codebase Understanding",
    description: "Blue learns how your codebase works, no matter the scale or complexity. Indexes every file, understands relationships, and navigates context effortlessly.",
  },
  {
    icon: "fa-rotate",
    title: "Self-Correcting Agents",
    description: "If a test fails, the agent reads the terminal output error, rewrites the code, and tests it again until it passes. No manual intervention needed.",
  },
  {
    icon: "fa-shield-halved",
    title: "Enterprise Security",
    description: "Your proprietary source code is protected by end-to-end encryption. Zero data retention, no model training, and local execution keep your code completely in your control.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="eyebrow">// capabilities</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight text-ink">
            AI agents that build, test, and fix code.
          </h2>
          <p className="mt-4 text-ink-muted max-w-2xl mx-auto">
            Blue&apos;s Autonomous Agents operate in a continuous loop to solve complex tasks.
            Give an Agent a goal and watch it plan, code, test, and self-correct until done.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="panel p-6 hover:border-line-strong transition-colors duration-150"
            >
              <div className="w-10 h-10 rounded-md bg-paper-alt border border-line flex items-center justify-center mb-5">
                <i className={`fa-solid ${feature.icon} text-base text-brand`}></i>
              </div>
              <h3 className="text-lg font-display font-bold tracking-tight text-ink mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/subscribe" className="btn btn-secondary">
            <i className="fa-solid fa-crown mr-2 text-accent"></i>
            See All Plans
            <i className="fa-solid fa-arrow-right ml-2 text-xs"></i>
          </Link>
        </div>
      </div>
    </section>
  );
}
