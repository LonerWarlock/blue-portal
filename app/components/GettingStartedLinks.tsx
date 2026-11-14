import Link from "next/link";
import { ArrowRight, BookOpen, Download, Wallet } from "lucide-react";

const resources = [
  { href: "/download", icon: Download, title: "Download and install Blue", body: "Get Blue Desktop for Windows from Microsoft and follow the steps to your first task.", label: "Windows installation guide" },
  { href: "/pricing", icon: Wallet, title: "Understand Blue pricing", body: "See what app access includes and how pay-as-you-go Blue Credits differ from provider billing.", label: "Compare plans and credits" },
  { href: "/docs", icon: BookOpen, title: "Find your way around Blue", body: "Set up a model, open a project and learn how coding mode and Desktop Team mode work.", label: "Read Blue docs" },
];

export default function GettingStartedLinks() {
  return <section aria-labelledby="blue-getting-started" className="border-t border-line py-16 sm:py-20">
    <div className="site-container">
      <p className="eyebrow text-brand">Start here</p>
      <h2 id="blue-getting-started" className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">New to Blue?</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">{resources.map(({ href, icon: Icon, title, body, label }) => <article key={href} className="flex flex-col rounded-xl border border-line bg-paper-alt p-6">
        <Icon size={22} aria-hidden="true" className="text-brand" /><h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3><p className="mt-3 flex-1 text-sm leading-7 text-ink-muted">{body}</p><Link href={href} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand hover:underline">{label}<ArrowRight size={15} aria-hidden="true" /></Link>
      </article>)}</div>
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm leading-7 text-ink-muted">
        <Link href="/hi/download" hrefLang="hi" lang="hi" className="min-h-11 py-2 text-brand underline underline-offset-4">Blue डाउनलोड करने की हिन्दी गाइड</Link>
        <p className="py-2">Comparing development tools? <Link href="/compare/emergent" className="font-medium text-brand underline underline-offset-4">Blue vs Emergent</Link> or <Link href="/compare/codex" className="font-medium text-brand underline underline-offset-4">Blue vs Codex</Link>.</p>
      </div>
    </div>
  </section>;
}
