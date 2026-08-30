import Link from "next/link";
import TerminalCard3D from "./TerminalCard3D";
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
            Autonomous Agents — Plan, Code, Test, Self-Correct
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight leading-tight text-ink">
            Let AI code for you
            <br />
            <span className="text-brand">while you think</span>
          </h1>

          <p className="mt-6 text-lg text-ink-muted max-w-2xl mx-auto leading-relaxed">
            Blue&apos;s Autonomous Agents don&apos;t just suggest code lines—they build entire features,
            run tests, and fix bugs by themselves.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link prefetch={false} href="/console" className="btn btn-primary text-base">
              Get Started
              <i className="fa-solid fa-arrow-right ml-2" />
            </Link>
            <Link prefetch={false} href="/subscribe" className="btn btn-secondary text-base">
              <i className="fa-solid fa-crown mr-2 text-accent" />
              See Plans
            </Link>
            <Link prefetch={false} href="/docs" className="btn btn-ghost text-base">
              <i className="fa-solid fa-book mr-2" />
              Docs
            </Link>
          </div>

          {/* Terminal Command Install Snippet */}
          <div className="mt-10">
            <VSCodeInstallSnippet />
          </div>
        </div>

        <div className="mt-16 max-w-5xl mx-auto">
          <TerminalCard3D />
        </div>
      </div>
    </section>
  );
}
