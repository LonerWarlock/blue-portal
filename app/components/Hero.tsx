import Link from "next/link";
import VSCodeInstallSnippet from "./VSCodeInstallSnippet";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-28 bg-paper-alt border-b border-line">
      {/* Faint blueprint-grid texture, hero only */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--line-strong) 1px, transparent 1px), linear-gradient(90deg, var(--line-strong) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            AI Coding Agents for Developers
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight leading-tight text-ink">
            Let AI code for you
            <br />
            <span className="text-brand">while you think</span>
          </h1>

          <p className="mt-6 text-lg text-ink-muted max-w-2xl mx-auto leading-relaxed">
            Blue understands your codebase, then builds entire features, writes
            tests, and fixes bugs on its own&mdash;working autonomously so you can
            focus on architecture, not busywork.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link prefetch={false} href="/console" className="btn btn-primary text-base">
              Get Started for Free
              <i className="fa-solid fa-arrow-right ml-2" />
            </Link>
            <Link prefetch={false} href="/contact" className="btn btn-secondary text-base">
              Book a Demo
            </Link>
          </div>

          <p className="mt-4 text-sm text-ink-faint">
            <Link prefetch={false} href="/subscribe" className="hover:text-ink-muted transition-colors duration-150">
              See plans &amp; pricing
            </Link>
            <span className="mx-2">&middot;</span>
            <Link prefetch={false} href="/docs" className="hover:text-ink-muted transition-colors duration-150">
              Read the docs
            </Link>
          </p>

          {/* Terminal Command Install Snippet */}
          <div className="mt-10">
            <VSCodeInstallSnippet />
          </div>
        </div>
      </div>
    </section>
  );
}
