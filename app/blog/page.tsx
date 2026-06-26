import PageLayout from "@/app/components/PageLayout";

const articles = [
  {
    title: "Why API Gateways Need Prepaid Tokens",
    description: "A deep dive into preventing credit leaks during streaming LLM responses.",
    icon: "fa-shield-halved",
    gradient: "from-blue-500 to-cyan-500",
    date: "Jun 24, 2026",
    readTime: "8 min read",
  },
  {
    title: "Reducing Autocomplete Latency by 40%",
    description: "How local file-caching and weight quantization improve inline code completion speed.",
    icon: "fa-gauge-high",
    gradient: "from-indigo-500 to-purple-500",
    date: "Jun 18, 2026",
    readTime: "12 min read",
  },
  {
    title: "How to Write Code Safely with Sandboxed Terminals",
    description: "The engineering behind secure local command execution.",
    icon: "fa-shield",
    gradient: "from-purple-500 to-pink-500",
    date: "Jun 10, 2026",
    readTime: "10 min read",
  },
];

export default function BlogPage() {
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
              Blog
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                The Blue
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Blog
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Technical posts, compiler engineering tips, and AI research updates.
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {articles.map((article) => (
              <div
                key={article.title}
                className="p-6 rounded-2xl glass border border-gray-800/80 hover:border-gray-700/80 hover:bg-gray-900/10 transition duration-300 group cursor-pointer flex flex-col"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${article.gradient} flex items-center justify-center mb-5`}>
                  <i className={`fa-solid ${article.icon} text-lg text-white`}></i>
                </div>
                <h3 className="text-lg font-bold text-gray-100 mb-3 group-hover:text-blue-400 transition">{article.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed flex-1 mb-6">{article.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-600 pt-4 border-t border-gray-800/50">
                  <span>{article.date}</span>
                  <span>{article.readTime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
