import Link from "next/link";
import PageLayout from "@/app/components/PageLayout";

export default function StatusPage() {
  return (
    <PageLayout>
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-20">
        <p className="eyebrow text-brand">SERVICE AVAILABILITY</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink sm:text-5xl">Blue availability information</h1>
        <p className="mt-6 text-lg leading-8 text-ink-muted">This page does not currently provide an automated public live status feed. It does not report measured uptime, latency or whether every service is operational.</p>
        <div className="mt-10 space-y-5">
          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-xl font-semibold text-ink">If a task or model request fails</h2>
            <p className="mt-3 text-sm leading-7 text-ink-muted">Check the error details, your internet connection and the account used by your selected engine or model provider. Provider availability, quotas and rate limits are separate from Blue. Local project work also depends on Blue running and your computer's tools and permissions.</p>
            <Link href="/docs#troubleshooting" className="mt-5 inline-flex min-h-11 items-center font-medium text-brand hover:underline">Read troubleshooting steps</Link>
          </section>
          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-xl font-semibold text-ink">Report an issue</h2>
            <p className="mt-3 text-sm leading-7 text-ink-muted">Tell us when the issue occurred, your app version, selected engine and model, and the error message. Do not include passwords or API keys.</p>
            <Link href="/contact" className="mt-5 inline-flex min-h-11 items-center font-medium text-brand hover:underline">Contact Blue support</Link>
          </section>
        </div>
      </section>
    </PageLayout>
  );
}
