import Link from "next/link";
import { MODELS } from "@/lib/models";

const featuredModels = Object.values(MODELS).filter(m =>
  ["claude-opus-4-8", "gpt-5.5-pro", "gemini-3.1-pro", "deepseek-v4-pro", "grok-build-0.1", "claude-sonnet-4-6"].includes(m.id)
);

const CategoriesLine = () => (
  <div className="flex flex-wrap gap-1.5 p-1 bg-paper-alt border border-line rounded-md max-w-full overflow-x-auto justify-center">
    {["All Models", "Free Tier", "Claude", "GPT-5", "Gemini", "Specialists"].map((label, i) => (
      <span
        key={i}
        className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap ${
          i === 0
            ? "bg-brand text-paper"
            : "text-ink-muted"
        }`}
      >
        {label}
      </span>
    ))}
  </div>
);

export default function ModelsShowcase() {
  return (
    <section id="models" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="eyebrow">// models</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight text-ink">
            Stay on the frontier.
          </h2>
          <p className="mt-4 text-ink-muted max-w-2xl mx-auto">
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
              className="panel p-6 hover:border-line-strong transition-colors duration-150"
            >
              <div className="flex justify-between items-start gap-4 mb-3">
                <span className="text-md font-display font-bold tracking-tight text-ink">
                  {model.displayName}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-semibold font-mono whitespace-nowrap border ${
                    model.isFree
                      ? "bg-success/10 border-success/40 text-success"
                      : "bg-brand/10 border-brand/30 text-brand"
                  }`}
                >
                  {model.isFree ? "Free" : "Premium"}
                </span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed min-h-[36px]">
                {model.description}
              </p>
              <div className="mt-4 pt-3 border-t border-line flex justify-between items-center text-xs">
                <span className="text-ink-muted">
                  ${model.inputPrice}/${model.outputPrice}
                  <span className="text-ink-faint">/1M tok</span>
                </span>
                <span className="text-success font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                  Active
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10 flex items-center justify-center gap-6">
          <Link
            href="/subscribe"
            className="inline-flex items-center gap-2 text-sm text-ink font-semibold hover:text-brand transition-colors duration-150"
          >
            <i className="fa-solid fa-crown text-xs text-accent"></i> See Plans
          </Link>
          <span className="text-line-strong">|</span>
          <a
            href="/console"
            className="inline-flex items-center gap-2 text-sm text-brand font-semibold hover:text-brand-hover transition-colors duration-150"
          >
            Explore all models <i className="fa-solid fa-arrow-right text-xs"></i>
          </a>
        </div>
      </div>
    </section>
  );
}
