import Link from "next/link";
import PageLayout from "@/app/components/PageLayout";

export default function CommunityPage() {
  return (
    <PageLayout>
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-20">
        <p className="eyebrow text-brand">BLUE SUPPORT</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink sm:text-5xl">Questions and feedback</h1>
        <p className="mt-6 text-lg leading-8 text-ink-muted">Use Blue's contact page for support, bug reports and feature requests. No public Discord server, discussion board or forum is linked here at this time.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-xl font-semibold text-ink">Contact the Blue team</h2>
            <p className="mt-3 text-sm leading-7 text-ink-muted">For a bug report, include the app version, selected engine and model, the error message and steps to reproduce it. Do not send passwords, API keys or private project files.</p>
            <Link href="/contact" className="mt-5 inline-flex min-h-11 items-center font-medium text-brand hover:underline">Open contact and support</Link>
          </section>
          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-xl font-semibold text-ink">Start with the documentation</h2>
            <p className="mt-3 text-sm leading-7 text-ink-muted">Find installation steps, model connections, project permissions and troubleshooting guidance.</p>
            <Link href="/docs" className="mt-5 inline-flex min-h-11 items-center font-medium text-brand hover:underline">Read Blue documentation</Link>
          </section>
        </div>
      </section>
    </PageLayout>
  );
}
