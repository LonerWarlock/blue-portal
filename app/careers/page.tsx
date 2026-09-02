import PageLayout from "@/app/components/PageLayout";

export default function CareersPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden px-4 pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-brand/10 blur-[112px] sm:h-96 sm:w-96 sm:blur-[128px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="eyebrow mb-6 inline-flex items-center gap-2 rounded-md border border-line-strong bg-paper px-3 py-1.5 sm:mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Careers
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              <span className="text-ink">Build the future of</span>
              <br />
              <span className="text-brand">coding agents</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-muted sm:mt-6 sm:text-lg">
              Blue is built by a remote-first team focused on affordable, capable coding agents.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-2xl rounded-xl border border-line bg-paper-alt p-6 text-center shadow-soft sm:mt-16 sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
              <i className="fa-solid fa-briefcase" aria-hidden="true" />
            </div>
            <p className="eyebrow mt-5">Hiring status</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              No open roles right now
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink-muted sm:text-base">
              We are not accepting job applications at this time. When a position becomes available, it will be published on this page.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-muted">
              <span className="h-2 w-2 rounded-full bg-ink-faint" />
              Please check back later
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
