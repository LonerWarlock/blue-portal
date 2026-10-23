import PageLayout from "@/app/components/PageLayout";
import AgentLiveDemo from "@/app/components/AgentLiveDemo";
import Link from "next/link";
import { canonicalUrl, createPageMetadata } from "@/lib/seo";
import DesktopDownloadLink from "@/app/components/DesktopDownloadLink";
import JsonLd from "@/app/components/JsonLd";

export const metadata = createPageMetadata("/product/agents", "Blue AI Coding Agent for Windows & VS Code | Imergene", "Understand code, debug and edit project files with Blue's AI coding agent. Compare coding chat, agent tasks and Desktop teams, with practical prompts and setup steps.");

const examples = [
  {
    title: "Understand an unfamiliar codebase",
    prompt: "Explain how this app starts and trace one user action through the relevant files. Cite the file paths. Do not change anything.",
    check: "Open the cited files and follow the explanation. Ask which parts were inspected and which are still uncertain.",
  },
  {
    title: "Investigate and fix a bug",
    prompt: "Reproduce this error, identify the cause, and propose the smallest fix. Preserve unrelated edits, run the relevant checks, and report any check that could not run.",
    check: "Compare the changed files, read the real command output, and repeat the original failing action. An unrun test is not a passing test.",
  },
  {
    title: "Build a bounded feature",
    prompt: "Add an empty state to this screen using the existing components. Keep navigation and data handling unchanged. Check the layout at narrow and wide widths.",
    check: "Try the actual screen in both states. Review its behavior and layout, not only the agent's summary.",
  },
];

const link = "font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand";

export default function AgentsPage() {
  return (
    <PageLayout>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
          { "@type": "ListItem", position: 2, name: "AI coding agent", item: canonicalUrl("/product/agents") },
        ],
      }} />
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
              Blue by Imergene
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                An AI coding agent
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                for your projects
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Blue by Imergene helps you understand code, plan changes, edit files
              and run relevant checks. Use Blue Desktop on Windows or the Blue
              Coding Assistant extension in VS Code. Review the result before you use it.
            </p>
          </div>

          {/* The demo remains explicitly labelled as illustrative. */}
          <div className="mt-20 max-w-5xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-ink">
              Watch Blue work
            </h2>

            <div className="mt-8">
              <AgentLiveDemo />
              <p className="mt-3 text-xs leading-6 text-ink-muted">Illustrative interface demonstration. Example output, not a live AI task or a performance benchmark.</p>
            </div>
          </div>

          {/* Feature Callouts */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-lg panel border border-line">
              <div className="w-12 h-12 rounded-lg bg-brand flex items-center justify-center mb-5">
                <i className="fa-solid fa-terminal text-lg text-white"></i>
              </div>
              <h3 className="text-lg font-bold text-ink mb-3">Terminal Integration</h3>
              <p className="text-sm text-ink-muted">Run relevant project commands with your local tools, subject to the selected engine, task permissions and available dependencies. Full Access tasks can work directly in your project; review changes and keep backups.</p>
            </div>
            <div className="p-6 rounded-lg panel border border-line">
              <div className="w-12 h-12 rounded-lg bg-brand flex items-center justify-center mb-5">
                <i className="fa-solid fa-eye text-lg text-white"></i>
              </div>
              <h3 className="text-lg font-bold text-ink mb-3">Independent Review</h3>
              <p className="text-sm text-ink-muted">Ask the agent to review its changes and run relevant checks. AI output can contain mistakes; always inspect the diff and test the result.</p>
            </div>
          </div>

          <div className="mt-20 max-w-5xl mx-auto space-y-14">
            <section aria-labelledby="coding-agent-explained">
              <h2 id="coding-agent-explained" className="text-2xl md:text-3xl font-display font-bold tracking-tight text-ink">What is an AI coding agent?</h2>
              <p className="mt-5 text-base leading-8 text-ink-muted">Code completion suggests the next lines while you type. Coding chat helps answer questions. A coding agent can use project files and tools to work through a requested change: inspect the code, plan an edit, change files and run checks. Blue provides a workspace for that work, using your selected supported engine and model connection. It is not a guarantee of correct, secure or finished code.</p>
              <p className="mt-4 text-base leading-8 text-ink-muted">Start with ordinary coding chat for an explanation or a focused change. Blue Desktop&apos;s <Link href="/teams" className={link}>Team mode</Link> adds specialist assignments for a larger goal and requires an active Blue Teams plan. The VS Code extension provides coding assistance, not Desktop Team mode. Independent projects may progress in parallel; tasks that write to overlapping folders can queue.</p>
            </section>

            <section aria-labelledby="coding-agent-examples">
              <h2 id="coding-agent-examples" className="text-2xl md:text-3xl font-display font-bold tracking-tight text-ink">Three useful tasks to try with Blue</h2>
              <p className="mt-4 text-base leading-8 text-ink-muted">These are prompts you can adapt to your own project, not recorded results or performance claims. Start with a small task in a project you can safely review.</p>
              <div className="mt-6 grid gap-5 md:grid-cols-3">
                {examples.map(example => <article key={example.title} className="min-w-0 rounded-xl border border-line bg-paper-alt p-6">
                  <h3 className="text-lg font-semibold text-ink">{example.title}</h3>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-muted">Example request</p>
                  <blockquote className="mt-2 border-l-2 border-brand/40 pl-4 text-sm leading-7 text-ink">{example.prompt}</blockquote>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-muted">What to verify</p>
                  <p className="mt-2 text-sm leading-7 text-ink-muted">{example.check}</p>
                </article>)}
              </div>
            </section>

            <section aria-labelledby="coding-agent-setup" className="rounded-xl border border-line p-6 sm:p-8">
              <h2 id="coding-agent-setup" className="text-2xl font-display font-bold tracking-tight text-ink">Start using Blue&apos;s coding agent</h2>
              <ol className="mt-5 list-decimal space-y-3 pl-6 text-base leading-8 text-ink-muted">
                <li><DesktopDownloadLink className={link}>Download Blue Desktop for Windows</DesktopDownloadLink>, or install the <a href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant" className={link} target="_blank" rel="noopener noreferrer">Blue Coding Assistant VS Code extension</a>.</li>
                <li>Sign in to Blue and choose a supported model connection. Follow the <Link href="/docs" className={link}>setup documentation</Link> for Blue models, OpenRouter BYOK or supported OpenCode account/key routes.</li>
                <li>Open the actual project folder, describe a bounded outcome and state what must not change. Keep version control or a backup.</li>
                <li>Follow the activity, respond to required approvals, then inspect the diff and check results. Ask for the precise blocker if work could not be verified.</li>
              </ol>
              <p className="mt-5 text-sm leading-7 text-ink-muted">App access and model usage are separate. Provider charges, credits, quotas and plan limits can apply; see <Link href="/pricing" className={link}>current pricing</Link>. Keep Blue and your computer on and awake for Desktop tasks. No always-on cloud execution is included.</p>
            </section>

            <section aria-labelledby="coding-agent-next">
              <h2 id="coding-agent-next" className="text-2xl font-display font-bold tracking-tight text-ink">Choose a workflow that fits your project</h2>
              <p className="mt-4 text-base leading-8 text-ink-muted">For coursework or a first project, use the <Link href="/guides/ai-coding-assistant-for-students" className={link}>student coding-assistant guide</Link> and follow your course&apos;s AI policy. For coordinated coding, research and browser work, read the <Link href="/guides/ai-agent-teams" className={link}>AI agent teams guide</Link>. Learn <Link href="/about" className={link}>who makes Blue and how access and usage work</Link> before choosing a plan.</p>
            </section>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/console"
              className="inline-flex px-8 py-3.5 rounded-lg bg-brand font-semibold text-white shadow-lg transition duration-200 text-base"
            >
              Get Started
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
