import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import PageLayout from "@/app/components/PageLayout";
import DesktopDownloadLink from "@/app/components/DesktopDownloadLink";
import JsonLd from "@/app/components/JsonLd";
import ComparisonPricing from "@/app/components/ComparisonPricing";
import { canonicalUrl, createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata(
  "/compare/emergent",
  "Blue Desktop vs Emergent | Pricing & Development Workflows",
  "Explore Blue as an Emergent AI alternative for Windows: project coding, a dedicated AI Team workspace, model choice and pay-as-you-go Teams pricing."
);

const strengths = [
  {
    title: "Code and coordinate in one app",
    description: "Work with a coding agent on a focused task, then open Team mode when you need specialists. Keep implementation, research and review organized in the same Windows workspace.",
  },
  {
    title: "Choose the model for each role",
    description: "Assign different supported models to different specialists. Choose according to the job and your budget, with the lead agent coordinating the team's responsibilities.",
  },
  {
    title: "Build on your existing workflow",
    description: "Open your project folder and work with your files, development commands and local preview. Add authorized services when the task needs them, and inspect the result in Blue's built-in browser.",
  },
];
const rows = [
  { topic: "Project workspace", blue: "Start a new project or open an existing local folder. Work with your source files and installed development tools.", emergent: "Browser-based app-building workspace, with GitHub integration and code export.", source: "overview" },
  { topic: "Organizing AI work", blue: "Switch between focused coding and a dedicated Team view. Give specialists names, roles, project assignments and individual conversations.", emergent: "AI-assisted app-building workflow; its Pro plan lists custom AI agents.", source: "plans" },
  { topic: "Model selection", blue: "Choose supported models for your work and assign different models to different specialists.", emergent: "Model access is offered within its platform, according to the current plan.", source: "plans" },
  { topic: "Connected tools", blue: "Use built-in service connections and add custom MCP connectors alongside your local files, browser and AI specialists.", emergent: "Offers an integration catalogue and support for MCP connectors.", source: "connectors" },
  { topic: "Development workflow", blue: "Use local commands, project previews, a built-in browser and authorized connections alongside your agents.", emergent: "Includes publishing and hosting options within its app-building workflow.", source: "overview" },
];
const link = "font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand";

export default function EmergentComparison() {
  return <PageLayout>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
      { "@type": "ListItem", position: 2, name: "Blue Desktop vs Emergent", item: canonicalUrl("/compare/emergent") },
    ] }} />
    <article className="site-container pb-24 pt-10 sm:pt-16" aria-labelledby="comparison-title">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted"><Link href="/" className="hover:text-brand">Blue by Imergene</Link><span aria-hidden="true" className="px-2">/</span><span aria-current="page">Blue vs Emergent</span></nav>
      <header className="mt-8 max-w-3xl">
        <p className="eyebrow text-brand">Your project. Your models. Your AI team.</p>
        <h1 id="comparison-title" className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-6xl">Blue Desktop vs Emergent</h1>
        <p className="mt-6 text-lg leading-8 text-ink-muted">Blue brings project coding, specialist AI agents and your local tools together in one Windows app. Start with a single change or coordinate a whole AI team, with a dedicated workspace to follow the work.</p>
        <p className="mt-4 text-base leading-8 text-ink-muted">Considering an Emergent AI alternative? Choose Blue when you want to work directly on your projects, select the models your specialists use and move between coding and team coordination inside the same app.</p>
        <div className="mt-7 flex flex-wrap gap-3"><DesktopDownloadLink className="btn btn-primary min-h-12 gap-2"><Download size={17} aria-hidden="true" />Get Blue for Windows</DesktopDownloadLink><Link href="/teams" className="btn btn-secondary min-h-12">Explore Blue Teams</Link></div>
        <p className="mt-5 text-xs leading-6 text-ink-muted">Published by Imergene, the maker of Blue. Comparison checked on <time dateTime="2026-11-14">14 November 2026</time>. Blue and Emergent are independent products.</p>
      </header>

      <section aria-labelledby="blue-strengths" className="mt-12">
        <h2 id="blue-strengths" className="text-3xl font-semibold tracking-tight text-ink">More ways to move your project forward.</h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">{strengths.map(item => <div key={item.title} className="rounded-xl border border-line bg-paper-alt p-6 sm:p-8"><h3 className="text-xl font-semibold text-ink">{item.title}</h3><p className="mt-4 text-base leading-8 text-ink-muted">{item.description}</p></div>)}</div>
      </section>

      <section className="mt-12 rounded-xl border border-line p-6 sm:p-8" aria-labelledby="team-workflow">
        <p className="eyebrow text-brand">An example for a software team</p>
        <h2 id="team-workflow" className="mt-3 text-3xl font-semibold tracking-tight text-ink">One goal. Clear responsibilities.</h2>
        <blockquote className="mt-5 max-w-3xl text-lg leading-8 text-ink">Build a client dashboard in this project, review it in the browser, and fix the issues you find.</blockquote>
        <p className="mt-4 max-w-3xl text-base leading-8 text-ink-muted">In Blue Team mode, the lead agent can divide a goal like this between an implementation specialist and a reviewer. Follow their responsibilities, open each specialist&apos;s conversation and inspect the project output in the built-in browser.</p>
        <p className="mt-4 max-w-3xl text-base leading-8 text-ink-muted">You can also create specialists yourself, set their roles and choose a supported model for each one. Keep a simple change in the project conversation, or bring in a team when the work needs separate responsibilities.</p>
        <Link href="/guides/ai-agent-teams" className={`${link} mt-5 inline-flex min-h-11 items-center gap-2`}>See how Blue Teams works<ArrowRight size={15} aria-hidden="true" /></Link>
      </section>

      <section className="mt-12" aria-labelledby="connected-tools">
        <h2 id="connected-tools" className="text-3xl font-semibold tracking-tight text-ink">Your team can work with your tools.</h2>
        <p className="mt-4 max-w-3xl text-base leading-8 text-ink-muted">Blue&apos;s built-in connectors extend what your agents can do. Bring repository context, design tools, deployment services and media creation into the same workflow as your local project and browser.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["GitHub", "Read repository context to support development and review."],
            ["Vercel", "Work with projects, deployments and logs."],
            ["React Bits", "Discover UI components and animations for your project."],
            ["Canva", "Create and work with designs through your connected account."],
            ["Creative Claw", "Generate media assets through your connected Creative Claw account."],
            ["Custom MCP connectors", "Add a supported MCP server to bring more tools into Blue."],
          ].map(([name, description]) => <div key={name} className="rounded-xl border border-line p-5"><h3 className="text-base font-semibold text-ink">{name}</h3><p className="mt-2 text-sm leading-7 text-ink-muted">{description}</p></div>)}
        </div>
        <p className="mt-4 max-w-3xl text-base leading-8 text-ink-muted">For example, a specialist can inspect repository context, another can use a connected design tool, and a reviewer can check the running project in Blue&apos;s browser. The lead agent coordinates their responsibilities while you follow the work in Team mode.</p>
        <p className="mt-3 text-sm leading-7 text-ink-muted">Connect the services you want to use. Access and available actions depend on your Blue plan, account permissions and any charges set by the service.</p>
        <Link href="/docs#connections" className={`${link} mt-3 inline-flex min-h-11 items-center gap-2`}>Explore Blue connections<ArrowRight size={15} aria-hidden="true" /></Link>
      </section>

      <section className="mt-12" aria-labelledby="workflow-comparison">
        <h2 id="workflow-comparison" className="text-3xl font-semibold tracking-tight text-ink">Compare the workspace behind the prompt.</h2>
        <p className="mt-4 max-w-3xl text-base leading-8 text-ink-muted">Blue centers the workflow on your local project, model choices and AI team. Emergent centers its workflow on building and publishing apps online. Both provide ways to work with source code; Blue&apos;s appeal is how its coding, specialist and browser tools come together on your computer.</p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[650px] border-collapse text-left text-sm leading-7">
            <caption className="sr-only">Blue Desktop and Emergent development workflows</caption>
            <thead className="bg-paper-alt"><tr><th scope="col" className="w-1/5 p-5 font-semibold text-ink">Workflow</th><th scope="col" className="w-2/5 p-5 font-semibold text-ink">Blue Desktop</th><th scope="col" className="w-2/5 p-5 font-semibold text-ink">Emergent</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.topic} className="border-t border-line"><th scope="row" className="p-5 align-top font-medium text-ink">{row.topic}</th><td className="p-5 align-top text-ink-muted">{row.blue}</td><td className="p-5 align-top text-ink-muted">{row.emergent} <a href={`#source-${row.source}`} className={link} aria-label={`Official source for ${row.topic.toLowerCase()}`}>Source</a></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <ComparisonPricing product="emergent" />

      <section aria-labelledby="comparison-questions" className="mt-12 border-t border-line pt-10">
        <h2 id="comparison-questions" className="text-2xl font-semibold text-ink">Getting started with Blue</h2>
        <div className="mt-5 divide-y divide-line">
          <details className="py-5"><summary className="cursor-pointer font-medium text-ink">Can I bring an existing project to Blue?</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">Yes. Open your local project folder, install its required dependencies and ask Blue to explore the code or make a change. You can also work with exported source code you have the right to use. <Link href="/download" className={link}>Follow the setup guide</Link>.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-medium text-ink">Can I code normally and use an AI team in the same app?</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">Yes. Use the project conversation for focused coding and Team mode for specialist coordination. Blue Teams refers to AI agents with their own roles and conversations. You can create them yourself or ask the lead agent to organize the work.</p></details>
          <details className="py-5"><summary className="cursor-pointer font-medium text-ink">How do I preview and deploy my project?</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">Use Blue&apos;s built-in browser to review your running project. For deployment, use your existing hosting workflow or an authorized connection to a supported service. Hosting is provided by the service you choose. Keep Blue open and your computer on and online while its agents work.</p></details>
        </div>
      </section>

      <section className="mt-12 border-t border-line pt-8" aria-labelledby="comparison-sources">
        <h2 id="comparison-sources" className="text-lg font-semibold text-ink">Official sources</h2>
        <p className="mt-3 text-sm leading-7 text-ink-muted">Emergent descriptions and plan details are based on its official pages, checked on 14 November 2026.</p>
        <ul className="mt-4 space-y-3 text-sm"><li id="source-overview" className="scroll-mt-28"><a href="https://emergent.sh/" target="_blank" rel="noopener noreferrer" className={link}>Emergent: product overview</a></li><li id="source-plans" className="scroll-mt-28"><a href="https://emergent.sh/pricing" target="_blank" rel="noopener noreferrer" className={link}>Emergent: published plans and pricing</a></li><li id="source-connectors" className="scroll-mt-28"><a href="https://help.emergent.sh/mcps-connectors" target="_blank" rel="noopener noreferrer" className={link}>Emergent: MCP and connector support</a></li><li><Link href="/docs" className={link}>Blue: setup and supported workflows</Link></li></ul>
      </section>

      <section className="mt-12 rounded-xl border border-line bg-paper-alt p-6 sm:p-8" aria-labelledby="try-blue">
        <h2 id="try-blue" className="text-3xl font-semibold tracking-tight text-ink">Bring your next project to Blue.</h2>
        <p className="mt-4 max-w-2xl text-base leading-8 text-ink-muted">Start with a coding task. Build up to a team. Keep your project, specialists and tools together in one Windows workspace.</p>
        <div className="mt-6 flex flex-wrap gap-3"><DesktopDownloadLink className="btn btn-primary min-h-12 gap-2"><Download size={17} aria-hidden="true" />Get Blue for Windows</DesktopDownloadLink><Link href="/pricing" className="btn btn-secondary min-h-12">See Blue pricing</Link></div>
      </section>
    </article>
  </PageLayout>;
}
