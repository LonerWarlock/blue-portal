import Link from "next/link";
import { ArrowRight, Code2, Download, ImagePlus, UsersRound } from "lucide-react";
import PageLayout from "@/app/components/PageLayout";
import DesktopDownloadLink from "@/app/components/DesktopDownloadLink";
import JsonLd from "@/app/components/JsonLd";
import { canonicalUrl, createPageMetadata, DESKTOP_APP_SCHEMA, DESKTOP_DESCRIPTION } from "@/lib/seo";

export const metadata = createPageMetadata(
  "/desktop",
  "Download Blue Desktop for Windows | AI Workspace by Imergene",
  DESKTOP_DESCRIPTION,
);

const link = "font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand";
const workflows = [
  { icon: Code2, title: "Build and debug your product", description: "Open a project folder. Ask Blue to explain the code, investigate a bug or implement a feature, then review the changed files and check results.", href: "/product/agents", label: "Explore coding agents" },
  { icon: UsersRound, title: "Coordinate your own AI team", description: "Tell the lead agent your goal. Create specialists for development, debugging, research or outreach, and let the lead agent distribute work and follow progress across projects.", href: "/teams", label: "Explore Blue Teams" },
  { icon: ImagePlus, title: "Create alongside your work", description: "Generate images with supported paid image models using Blue Credits. Connect your own creative-service accounts when you want Blue to use those tools for a task.", href: "/docs", label: "Read the documentation" },
];

export default function DesktopPage() {
  return <PageLayout>
    <JsonLd data={{
      "@context": "https://schema.org",
      "@graph": [
        DESKTOP_APP_SCHEMA,
        { "@type": "WebPage", "@id": `${canonicalUrl('/desktop')}#webpage`, url: canonicalUrl('/desktop'), name: "Blue Desktop for Windows", description: DESKTOP_DESCRIPTION, isPartOf: { "@id": `${canonicalUrl('/')}#website` }, mainEntity: { "@id": DESKTOP_APP_SCHEMA['@id'] } },
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl('/') },
          { "@type": "ListItem", position: 2, name: "Blue Desktop", item: canonicalUrl('/desktop') },
        ] },
      ],
    }} />
    <div className="site-container py-12 sm:py-20">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted">
        <Link href="/" className="hover:text-ink">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Blue Desktop</span>
      </nav>
      <header className="max-w-4xl pt-10 sm:pt-14">
        <p className="eyebrow">Windows desktop app · By Imergene</p>
        <h1 className="mt-5 font-display text-5xl font-semibold tracking-tight text-ink sm:text-7xl">Blue Desktop</h1>
        <p className="mt-6 text-2xl font-medium leading-snug text-ink sm:text-3xl">Your code. Your projects. Your AI team.</p>
        <p className="mt-5 max-w-2xl text-base leading-8 text-ink-muted">Blue Desktop by Imergene is an AI coding assistant and multi-agent workspace for Windows. Work on local projects, coordinate custom AI agents, research in the built-in browser and choose the AI model that fits your task.</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <DesktopDownloadLink className="btn btn-primary min-h-12 gap-2">Download Blue Desktop <Download size={17} aria-hidden="true" /></DesktopDownloadLink>
          <DesktopDownloadLink variant="store" className="btn btn-secondary min-h-12 gap-2">View on Microsoft Store <ArrowRight size={16} aria-hidden="true" /></DesktopDownloadLink>
        </div>
        <p className="mt-4 text-sm leading-6 text-ink-muted">Windows desktop release. Internet access and a model connection are required.</p>
      </header>

      <section aria-labelledby="desktop-workflows" className="mt-16 border-t border-line pt-10 sm:mt-20">
        <h2 id="desktop-workflows" className="font-display text-3xl font-semibold tracking-tight text-ink">One workspace. More ways to work.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {workflows.map(({ icon: Icon, title, description, href, label }) => <article key={title} className="flex flex-col rounded-xl border border-line bg-paper-alt p-6">
            <Icon size={23} className="text-brand" aria-hidden="true" />
            <h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3>
            <p className="mt-3 flex-1 text-sm leading-7 text-ink-muted">{description}</p>
            <Link href={href} className={`${link} mt-5 inline-flex min-h-10 items-center gap-2 text-sm`}>{label}<ArrowRight size={15} aria-hidden="true" /></Link>
          </article>)}
        </div>
      </section>

      <section aria-labelledby="desktop-setup" className="mt-16 grid gap-8 border-t border-line pt-10 lg:grid-cols-2 lg:gap-16">
        <div><p className="eyebrow">Get started</p><h2 id="desktop-setup" className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">From download to your first task.</h2><p className="mt-5 text-base leading-8 text-ink-muted">The download uses Microsoft&apos;s official installer. Microsoft Store serves the latest version available for your device after release approval.</p></div>
        <ol className="list-decimal space-y-5 pl-6 text-base leading-7 text-ink-muted marker:font-semibold marker:text-brand">
          <li><strong className="text-ink">Install and sign in.</strong> Download Blue Desktop for Windows, open the installer and sign in to your Blue account.</li>
          <li><strong className="text-ink">Choose your model connection.</strong> In Setup Wizard, choose Blue Models with Blue Credits or connect your own supported provider key for project work.</li>
          <li><strong className="text-ink">Give Blue a task.</strong> Start a conversation or add a local project folder. For a larger goal, open Team mode and let the lead agent coordinate specialists.</li>
        </ol>
      </section>

      <section aria-labelledby="desktop-costs" className="mt-16 rounded-xl border border-line bg-paper-alt p-6 sm:p-8">
        <h2 id="desktop-costs" className="font-display text-2xl font-semibold tracking-tight text-ink">Choose how you use Blue.</h2>
        <div className="mt-5 grid gap-6 text-sm leading-7 text-ink-muted md:grid-cols-2">
          <p><strong className="text-ink">Project work:</strong> app-feature access and AI usage are separate. With your own provider key, model charges and limits belong to that provider. Blue Models uses your Blue Credit balance.</p>
          <p><strong className="text-ink">Blue Teams:</strong> purchase at least 25 Blue Credits to activate Team mode while your wallet has credits. A 30% platform fee is added at checkout. Lead-agent and specialist model usage shares the same wallet.</p>
        </div>
        <Link href="/pricing" className={`${link} mt-5 inline-flex min-h-10 items-center text-sm`}>Compare current plans and model-usage costs</Link>
      </section>

      <section aria-labelledby="desktop-questions" className="mt-16 max-w-3xl">
        <h2 id="desktop-questions" className="font-display text-3xl font-semibold tracking-tight text-ink">Before your first project.</h2>
        <div className="mt-7 divide-y divide-line border-y border-line">
          <details className="py-5"><summary className="cursor-pointer font-medium text-ink">How is Blue Desktop different from the VS Code extension?</summary><p className="mt-3 text-sm leading-7 text-ink-muted">Blue Desktop is a standalone Windows app with project conversations, Desktop Team mode, a built-in browser and account connections. Blue Coding Assistant brings coding assistance into VS Code. Desktop Team mode is not part of the extension. <a href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant" className={link}>View the VS Code extension</a>.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-medium text-ink">Does the AI run entirely on my computer?</summary><p className="mt-3 text-sm leading-7 text-ink-muted">Blue runs the agent workspace and local development tools on your computer. AI model requests use your selected online provider; this is not an offline model. Keep Blue open and your computer awake and online while agents are working.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-medium text-ink">Can I choose my own AI model?</summary><p className="mt-3 text-sm leading-7 text-ink-muted">Yes. Choose a supported model from your connection&apos;s catalogue. Availability, capabilities, pricing and limits vary by model and provider. Desktop Teams uses Blue Models and Blue Credits.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-medium text-ink">What should I try first?</summary><p className="mt-3 text-sm leading-7 text-ink-muted">Open a project you know and ask Blue to explain one feature before making changes. Then try a focused bug fix and review the files and test results. See the <Link href="/docs" className={link}>setup documentation</Link> and <Link href="/guides/ai-agent-teams" className={link}>AI agent teams guide</Link>.</p></details>
        </div>
      </section>
    </div>
  </PageLayout>;
}
