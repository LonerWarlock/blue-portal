import Link from "next/link";

export default function CtaSection() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="panel-alt border-t-2 border-t-brand p-12 md:p-16 text-center">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-ink">
            Try Blue now.
          </h2>
          <p className="mt-4 text-ink-muted max-w-xl mx-auto">
            Get started free — every new sign-up receives $1.00 of free starter credits. No credit card required.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/console" className="btn btn-primary text-base">
              Get Started Free
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
            <Link href="/subscribe" className="btn btn-secondary text-base">
              <i className="fa-solid fa-crown mr-2 text-accent"></i>
              See Plans
            </Link>
            <Link href="/docs" className="btn btn-ghost text-base">
              View Documentation
            </Link>
          </div>
          <p className="mt-6 text-xs text-ink-faint">
            Free tier models (DeepSeek V4 Flash, MiMo V2.5, Nemotron) cost $0.00 — they never drain your wallet.
          </p>
        </div>
      </div>
    </section>
  );
}
