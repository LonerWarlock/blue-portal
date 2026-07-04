import Link from "next/link";
import { MODELS } from "@/lib/models";

const featuredModels = Object.values(MODELS).filter(m =>
  ["claude-opus-4-8", "gpt-5.5-pro", "gemini-3.1-pro", "deepseek-v4-pro", "grok-build-0.1", "claude-sonnet-4-6"].includes(m.id)
);

const CategoriesLine = () => (
  <div className="flex flex-wrap gap-1.5 p-1 bg-gray-950 border border-gray-900/50 rounded-xl max-w-full overflow-x-auto justify-center">
    {["All Models", "Free Tier", "Claude", "GPT-5", "Gemini", "Specialists"].map((label, i) => (
      <span
        key={i}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
          i === 0
            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10"
            : "text-gray-400"
        }`}
      >
        {label}
      </span>
    ))}
  </div>
);

export default function ModelsShowcase() {
  return (
    <section id="models" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Stay on the frontier.
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Use the best model for every task. Blue gives you access to every cutting-edge model from all major AI labs.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-10">
          <CategoriesLine />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredModels.map((model) => (
            <div
              key={model.id}
              className="p-6 rounded-2xl glass border border-gray-800/80 hover:border-gray-700/80 transition duration-300"
            >
              <div className="flex justify-between items-start gap-4 mb-3">
                <span className="text-md font-bold tracking-tight text-gray-200">
                  {model.displayName}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-semibold font-mono whitespace-nowrap ${
                    model.isFree
                      ? "bg-green-950/60 border border-green-900/60 text-green-400"
                      : "bg-blue-950/60 border border-blue-900/60 text-blue-400"
                  }`}
                >
                  {model.isFree ? "Free" : "Premium"}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed min-h-[36px]">
                {model.description}
              </p>
              <div className="mt-4 pt-3 border-t border-gray-800/50 flex justify-between items-center text-xs">
                <span className="text-gray-500">
                  ${model.inputPrice}/${model.outputPrice}
                  <span className="text-gray-600">/1M tok</span>
                </span>
                <span className="text-green-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Active
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10 flex items-center justify-center gap-6">
          <Link
            href="/subscribe"
            className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 font-semibold transition"
          >
            <i className="fa-solid fa-crown text-xs"></i> See Plans
          </Link>
          <span className="text-gray-700">|</span>
          <a
            href="/console"
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-semibold transition"
          >
            Explore all models <i className="fa-solid fa-arrow-right text-xs"></i>
          </a>
        </div>
      </div>
    </section>
  );
}
