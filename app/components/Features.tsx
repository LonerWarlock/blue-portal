const features = [
  {
    icon: "fa-microchip",
    title: "Multi-Model Architecture",
    description: "Choose between every cutting-edge model from OpenAI, Anthropic, Gemini, xAI, and open-source specialists. Use the best model for every task.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: "fa-code-branch",
    title: "Agentic Coding",
    description: "Blue Agents operate in a continuous loop — planning, writing code, running terminals, and self-correcting until every test passes. Hand off complex tasks while you focus on architecture.",
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    icon: "fa-terminal",
    title: "Terminal Integration",
    description: "Safe sandboxed terminal execution that runs locally on your machine. Blue runs lint checks, compiles, and tests your code, then inspects the diff for syntax errors before finishing.",
    gradient: "from-green-500 to-teal-500",
  },
  {
    icon: "fa-sitemap",
    title: "Complete Codebase Understanding",
    description: "Blue learns how your codebase works, no matter the scale or complexity. Indexes every file, understands relationships, and navigates context effortlessly.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: "fa-rotate",
    title: "Self-Correcting Agents",
    description: "If a test fails, the agent reads the terminal output error, rewrites the code, and tests it again until it passes. No manual intervention needed.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: "fa-shield-halved",
    title: "Enterprise Security",
    description: "Your proprietary source code is protected by end-to-end encryption. Zero data retention, no model training, and local execution keep your code completely in your control.",
    gradient: "from-blue-600 to-indigo-600",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            AI agents that build, test, and fix code.
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Blue&apos;s Autonomous Agents operate in a continuous loop to solve complex tasks.
            Give an Agent a goal and watch it plan, code, test, and self-correct until done.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl glass border border-gray-800/80 hover:border-gray-700/80 hover:bg-gray-900/10 transition duration-300 group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg mb-5`}>
                <i className={`fa-solid ${feature.icon} text-lg text-white`}></i>
              </div>
              <h3 className="text-lg font-bold tracking-tight text-gray-100 mb-3">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
