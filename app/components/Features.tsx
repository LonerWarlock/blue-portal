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
    description: "Blue works autonomously — planning, building, testing, and demoing features end to end. Hand off tasks while you focus on architecture decisions.",
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    icon: "fa-sitemap",
    title: "Complete Codebase Understanding",
    description: "Blue learns how your codebase works, no matter the scale or complexity. Indexes every file, understands relationships, and navigates context effortlessly.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: "fa-terminal",
    title: "Terminal & IDE Native",
    description: "Blue runs in your terminal, your IDE, and your CI/CD pipeline. No context switching — meet developers where they already work.",
    gradient: "from-green-500 to-teal-500",
  },
  {
    icon: "fa-slack",
    title: "Team Collaboration",
    description: "Integrates with Slack and GitHub. Review PRs, discuss features, and ship code together — all with AI-powered assistance across your entire workflow.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: "fa-shield-halved",
    title: "Enterprise Security",
    description: "SOC 2 compliant, with secure codebase indexing and fine-grained access controls. Trusted by over half of the Fortune 500.",
    gradient: "from-blue-600 to-indigo-600",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            The new way to build software.
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Blue gives every developer a powerful AI agent that understands your entire codebase,
            works autonomously, and integrates at every step of your workflow.
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
