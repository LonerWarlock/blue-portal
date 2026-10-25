import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import PageLayout from "@/app/components/PageLayout";
import DesktopDownloadLink from "@/app/components/DesktopDownloadLink";
import JsonLd from "@/app/components/JsonLd";
import { canonicalUrl, createPageMetadata, TEAM_GUIDE_PATH } from "@/lib/seo";

const guidePath = TEAM_GUIDE_PATH;

export const metadata = createPageMetadata(
  TEAM_GUIDE_PATH,
  "AI Agent Teams for Coding, Research and Browser Work on Windows | Blue",
  "A practical guide to Blue Teams: delegate coding, research and browser tasks, understand parallel work, review results, and plan for local execution and model costs.",
);

const sections = [
  { id: "what-a-team-does", label: "What an AI team does" },
  { id: "first-workflow", label: "Start a useful workflow" },
  { id: "parallel-work", label: "When work runs in parallel" },
  { id: "examples", label: "Three practical examples" },
  { id: "limits-and-costs", label: "Local execution and costs" },
  { id: "questions", label: "Common questions" },
];

const faqs = [
  {
    question: "Does Blue Teams run when my computer is off?",
    answer: "No. Blue Teams executes locally. Keep Blue open, your computer on and awake, and an internet connection available while tasks are running. Eligible unfinished responsibilities can continue after Blue restarts and checks the same account, project, model connection and task scope; that is not continuous cloud execution.",
  },
  {
    question: "Can two project teams work at the same time?",
    answer: "Yes, independent projects can progress in parallel when worker capacity and the model provider allow it. Tasks that can edit the same or overlapping folders may queue to avoid overwrites. Several saved specialists do not mean that all of them are executing simultaneously.",
  },
  {
    question: "Do I need a coding project to use Team mode?",
    answer: "No. A Team workspace can organize research or browser work without an existing code folder. Give Blue a specific outcome, permitted sources and a deliverable. For inspecting or changing an existing app, select its actual project folder.",
  },
  {
    question: "Does Blue Teams include unlimited model usage?",
    answer: "No. Teams uses Blue Models and your Blue Credits. A purchase of at least 25 credits activates Teams while your wallet has credits. 1 credit covers $1 of actual OpenRouter usage, and a 30% platform fee is charged at checkout. More agents or longer tasks can increase usage.",
  },
  {
    question: "Will agents send messages or publish changes without permission?",
    answer: "A role or general goal is not permission to take every external action. Blue keeps approval and account boundaries. State explicitly whether you authorize sending, publishing or other consequential actions; a required approval, sign-in or verification step can still pause the task. Review the actual result before assuming an external action succeeded.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
    { "@type": "ListItem", position: 2, name: "Blue Teams", item: canonicalUrl("/teams") },
    { "@type": "ListItem", position: 3, name: "AI agent teams guide", item: canonicalUrl(guidePath) },
  ],
};

const copy = "mt-4 text-base leading-8 text-ink-muted";
const heading = "text-2xl font-semibold tracking-tight text-ink sm:text-3xl";
const link = "font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand";

export default function AiAgentTeamsGuide() {
  return (
    <PageLayout>
      <JsonLd data={structuredData} />
      <article className="site-container pb-24 pt-10 sm:pt-16" aria-labelledby="team-guide-title">
        <nav aria-label="Breadcrumb" className="text-sm leading-7 text-ink-muted">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li><Link href="/" className="hover:text-brand">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/teams" className="hover:text-brand">Blue Teams</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">AI agent teams guide</li>
          </ol>
        </nav>

        <header className="mt-8 max-w-3xl">
          <p className="eyebrow text-brand">A practical Blue Teams guide</p>
          <h1 id="team-guide-title" className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            AI agent teams for coding, research and browser work on Windows
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink-muted">
            Blue Teams is a mode in Blue Desktop that organizes a goal into
            specialist assignments and keeps their progress with the relevant
            project. Use it when work benefits from separate responsibilities,
            not just a longer chat. You stay responsible for permissions and
            reviewing what actually happened.
          </p>
          <p className="mt-4 text-sm text-ink-muted">By the Blue team at Imergene · Product workflow guide</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <DesktopDownloadLink className="btn btn-primary min-h-11"><Download size={16} aria-hidden="true" className="mr-2" />Download Blue for Windows</DesktopDownloadLink>
            <Link href="/teams" className="btn btn-secondary min-h-11">View Blue Teams credit access</Link>
          </div>
        </header>

        <div className="mt-12 grid gap-10 border-t border-line pt-10 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="Guide sections" className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">In this guide</p>
            <ul className="mt-3 grid gap-1">
              {sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="block rounded-md px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-paper-alt hover:text-ink">{section.label}</a></li>)}
            </ul>
          </nav>

          <div className="min-w-0 max-w-3xl space-y-12">
            <section id="what-a-team-does" className="scroll-mt-28">
              <h2 className={heading}>One goal, clear specialist responsibilities</h2>
              <p className={copy}>
                The main Blue conversation coordinates the outcome. Specialists
                have their own roles, chats and task activity, so you can inspect
                a researcher&apos;s sources separately from a developer&apos;s file
                changes. A useful handoff passes an observed result to the next
                task; dependent work should not assume that an unfinished step
                has succeeded.
              </p>
              <p className={copy}>
                For a small explanation, an ordinary chat can be enough. For a
                larger goal, ask for concrete deliverables: a comparison with
                source links, a focused code change with checks, or a reviewed
                draft. A saved role describes a specialist&apos;s focus; it is not
                permission to invent unrelated work or access other accounts.
              </p>
            </section>

            <section id="first-workflow" className="scroll-mt-28">
              <h2 className={heading}>Start with a bounded workflow</h2>
              <ol className="mt-5 list-decimal space-y-4 pl-6 text-base leading-8 text-ink-muted">
                <li><strong className="font-semibold text-ink">Set up the connection.</strong> Sign in to Blue, choose a Blue Model, and check your Teams credit access. Follow the <Link href="/docs" className={link}>setup documentation</Link> if this is your first run.</li>
                <li><strong className="font-semibold text-ink">Choose the right workspace.</strong> Select your project folder for file work, or use a separate Team workspace for a research or browser task. Keep unrelated projects separate.</li>
                <li><strong className="font-semibold text-ink">Describe the outcome and boundaries.</strong> Include sources, files, constraints, what must not change, and what evidence would count as complete. Say whether external actions are authorized.</li>
                <li><strong className="font-semibold text-ink">Follow the actual activity.</strong> Open a specialist&apos;s chat for its work details. Respond to required approvals or sign-in handoffs; queued or waiting is not the same as working.</li>
                <li><strong className="font-semibold text-ink">Review the deliverable.</strong> Read source links, inspect changed files, and try the relevant behavior yourself. Ask what failed or could not be verified before moving on.</li>
              </ol>
              <p className={copy}>For a student project, the <Link href="/guides/ai-coding-assistant-for-students" className={link}>student coding assistant guide</Link> also explains how to use small tasks to evaluate explanations and learn from the result.</p>
            </section>

            <section id="parallel-work" className="scroll-mt-28">
              <h2 className={heading}>Parallel where independent, queued where shared</h2>
              <p className={copy}>
                Parallel agents are useful when one assignment does not need
                another&apos;s unfinished result. Separate project folders and
                independent browser research may progress together, subject to
                Blue&apos;s available workers, your model provider&apos;s limits and
                your computer&apos;s resources. Switching the visible project does
                not itself pause another team.
              </p>
              <p className={copy}>
                Tasks that can write directly to the same or overlapping project
                folders take turns to avoid overwrites. Shared website actions
                can also wait for the same signed-in site, and physical desktop
                control is one-at-a-time. An agent listed in your plan is saved
                team capacity, not a promise that every agent runs concurrently.
                More specialists do not automatically make a dependent task faster.
              </p>
            </section>

            <section id="examples" className="scroll-mt-28">
              <h2 className={heading}>Three practical tasks to try</h2>
              <div className="mt-6 space-y-6">
                <section className="rounded-xl border border-line bg-paper-alt p-5 sm:p-6">
                  <h3 className="text-lg font-semibold text-ink">Plan and build a small app feature</h3>
                  <p className={copy}>Separate requirements research from a focused implementation. Have the developer use the existing project structure and report completed checks. Direct edits in Full Access can leave partial changes if a task stops or fails, so keep version control and review the result.</p>
                  <blockquote className="mt-4 border-l-2 border-brand pl-4 text-sm leading-7 text-ink">In this project, prepare a short requirement checklist for a search filter, then implement the agreed behavior. Preserve unrelated changes. Run the existing relevant checks and report what passed, failed or could not be verified. Do not deploy.</blockquote>
                </section>
                <section className="rounded-xl border border-line bg-paper-alt p-5 sm:p-6">
                  <h3 className="text-lg font-semibold text-ink">Research options and produce a decision brief</h3>
                  <p className={copy}>Give researchers a comparison question and ask for direct sources, dates and uncertainties. A decision brief is useful when it distinguishes published facts from assumptions; it is not proof that every provider claim is true.</p>
                  <blockquote className="mt-4 border-l-2 border-brand pl-4 text-sm leading-7 text-ink">Create a separate workspace to compare three scheduling tools for a two-person studio. Use official product and pricing pages, link sources, and explain costs, limits and unknowns. Recommend a shortlist. Do not create accounts or purchase anything.</blockquote>
                </section>
                <section className="rounded-xl border border-line bg-paper-alt p-5 sm:p-6">
                  <h3 className="text-lg font-semibold text-ink">Prepare browser-based work for review</h3>
                  <p className={copy}>Agents can inspect supported websites in Blue&apos;s in-app browser. Your account may require manual sign-in, verification or approval. Compatibility and service permissions still apply; do not assume Blue can operate every website or bypass its restrictions.</p>
                  <blockquote className="mt-4 border-l-2 border-brand pl-4 text-sm leading-7 text-ink">Using the public pages of these five companies, summarize their stated services and prepare a tailored outreach draft for each. Link the source behind each observation. Do not scrape private contact data, send messages or submit forms.</blockquote>
                </section>
              </div>
            </section>

            <section id="limits-and-costs" className="scroll-mt-28">
              <h2 className={heading}>Keep the computer on, and budget for model usage</h2>
              <p className={copy}>
                <strong className="font-semibold text-ink">Blue Teams runs on your computer, not an always-on cloud worker.</strong>{" "}
                Keep Blue open, your computer on and awake, and your internet
                connection available. Sleep, shutdown, closing Blue, account
                changes or a provider outage can interrupt work. Eligible saved
                responsibilities can resume after restart with fresh checks of
                their scope and actual progress; completed, stopped or expired
                work should not be replayed.
              </p>
              <p className={copy}>
                Activate Teams with a purchase of at least 25 Blue Credits in one payment.
                Access continues while your wallet has credits, with up to 10 project teams and 8 agents per team.
                Both the main agent and specialists use Blue Models and the same wallet. Top-ups add to your remaining balance;
                credits do not expire or reset monthly. If the balance reaches zero, Teams pauses and another purchase of at least 25 credits reactivates it.
              </p>
              <p className={copy}>
                1 Blue Credit covers $1 of actual OpenRouter usage. A 30% platform fee is added at checkout, without another platform markup during usage.
                See <Link href="/teams" className={link}>Blue Teams credit access</Link> and <Link href="/blue-pro/checkout?pack=custom&amp;credits=25" className={link}>current checkout totals</Link> before purchasing.
                Longer tasks and additional agents can increase usage. Start with one bounded task before scaling up.
              </p>
            </section>

            <section id="questions" className="scroll-mt-28">
              <h2 className={heading}>Common questions about Blue Teams</h2>
              <dl className="mt-6 divide-y divide-line">
                {faqs.map(faq => <div key={faq.question} className="py-6 first:pt-0"><dt className="text-lg font-semibold leading-7 text-ink">{faq.question}</dt><dd className="mt-3 text-base leading-8 text-ink-muted">{faq.answer}</dd></div>)}
              </dl>
              <Link href="/teams" className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-brand hover:underline">Explore Blue Teams credit access <ArrowRight size={16} aria-hidden="true" /></Link>
            </section>
          </div>
        </div>
      </article>
    </PageLayout>
  );
}
