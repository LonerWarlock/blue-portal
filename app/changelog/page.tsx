import Link from "next/link";
import PageLayout from "@/app/components/PageLayout";
import DesktopDownloadLink from "@/app/components/DesktopDownloadLink";

export default function ChangelogPage() {
  return (
    <PageLayout>
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-20">
        <p className="eyebrow text-brand">BLUE UPDATES</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink sm:text-5xl">Find the published release information</h1>
        <p className="mt-6 text-lg leading-8 text-ink-muted">A dated release history is not maintained on this page yet. Check the listing for the Blue app you use, and refer to the documentation for the currently described features.</p>
        <div className="mt-10 space-y-5">
          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-xl font-semibold text-ink">Blue Desktop for Windows</h2>
            <p className="mt-3 text-sm leading-7 text-ink-muted">Visit the official Microsoft Store listing for the available Windows release and any release notes published there. A submitted update may still be under Microsoft's review.</p>
            <DesktopDownloadLink variant="store" className="mt-5 inline-flex min-h-11 items-center font-medium text-brand hover:underline">View Blue on Microsoft Store</DesktopDownloadLink>
          </section>
          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-xl font-semibold text-ink">Blue Coding Assistant for VS Code</h2>
            <p className="mt-3 text-sm leading-7 text-ink-muted">Use the official extension listing for published extension versions and available release information. Desktop and extension versions are separate.</p>
            <a href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center font-medium text-brand hover:underline">View the VS Code extension</a>
          </section>
        </div>
        <Link href="/docs" className="mt-8 inline-flex min-h-11 items-center font-medium text-brand hover:underline">Read Blue documentation</Link>
      </section>
    </PageLayout>
  );
}
