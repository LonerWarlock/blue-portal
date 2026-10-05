import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import PageLayout from "@/app/components/PageLayout";
import DesktopDownloadLink from "@/app/components/DesktopDownloadLink";
import VSCodeInstallSnippet from "@/app/components/VSCodeInstallSnippet";
import { BLUE_SUBSCRIPTION_PLANS } from "@/lib/blueSubscriptionPlans";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata(
  "/guides/ai-coding-assistant-for-students",
  "Choosing the Best AI Coding Assistant for Students | Blue",
  "A practical guide to choosing an AI coding assistant for student projects: explanations, Windows and VS Code workflows, model costs, and reviewing results.",
);

const sections = [
  { id: "start-with-the-work", label: "Start with your project" },
  { id: "selection-criteria", label: "What to look for" },
  { id: "evaluate-an-assistant", label: "Try one small task" },
  { id: "blue-workflow", label: "Windows and VS Code" },
  { id: "understand-the-cost", label: "Understand the cost" },
  { id: "learn-responsibly", label: "Learn responsibly" },
];

const copy = "mt-4 text-base leading-8 text-ink-muted";
const heading = "text-2xl font-semibold tracking-tight text-ink sm:text-3xl";
const link = "font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand";

export default function StudentCodingAssistantGuide() {
  const { monthly, quarterly, yearly } = BLUE_SUBSCRIPTION_PLANS;

  return (
    <PageLayout>
      <article className="site-container pb-24 pt-14 sm:pt-20" aria-labelledby="student-guide-title">
        <header className="max-w-3xl">
          <p className="eyebrow text-brand">A practical student guide</p>
          <h1 id="student-guide-title" className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            How to choose the best AI coding assistant for students
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink-muted">
            The best assistant for your project is one that helps you understand
            the work, fits your tools and budget, and makes its changes easy to
            review. Start with a small, real task—not a promise of effortless code.
          </p>
          <p className="mt-4 text-sm text-ink-muted">By the Blue team at Imergene · Product and learning guide</p>
        </header>

        <div className="mt-12 grid gap-10 border-t border-line pt-10 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="Guide sections" className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">In this guide</p>
            <ul className="mt-3 grid gap-1">
              {sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="block rounded-md px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-paper-alt hover:text-ink">{section.label}</a></li>)}
            </ul>
          </nav>

          <div className="min-w-0 max-w-3xl space-y-12">
            <section id="start-with-the-work" className="scroll-mt-28">
              <h2 className={heading}>Start with the work you need to do</h2>
              <p className={copy}>
                A quick question about a loop is different from fixing a bug in
                a project with several files. For explanations, a general chat
                can be enough. For project help, look for an assistant that can
                work with your folder, explain the surrounding code, propose
                changes, and run the checks your project already uses.
              </p>
              <p className={copy}>
                Write down your next task: understanding a starter repository,
                building a small website, fixing an error, or adding a feature.
                Include your language, operating system, and editor. This gives
                you a useful way to evaluate an AI coding assistant instead of
                choosing solely by a model name or an impressive demonstration.
              </p>
            </section>

            <section id="selection-criteria" className="scroll-mt-28">
              <h2 className={heading}>Look for clear explanations and control</h2>
              <ul className="mt-5 space-y-4 text-base leading-8 text-ink-muted">
                <li><strong className="font-semibold text-ink">Learning value.</strong> Can it explain why a change works, identify assumptions, and help you reason through an error rather than only paste a replacement?</li>
                <li><strong className="font-semibold text-ink">Project context.</strong> Can it inspect the relevant files and follow your existing structure instead of inventing a different app?</li>
                <li><strong className="font-semibold text-ink">Reviewability.</strong> Can you see changed files, commands, test results, and anything it could not verify?</li>
                <li><strong className="font-semibold text-ink">Costs and permissions.</strong> Are platform access, model usage, limits, and sensitive actions explained before you commit?</li>
              </ul>
              <p className={copy}>
                Speed matters, but a fast answer that you cannot explain is not
                necessarily a good result. Prefer an assistant that states when
                a check failed or a result is uncertain.
              </p>
            </section>

            <section id="evaluate-an-assistant" className="scroll-mt-28">
              <h2 className={heading}>Evaluate it with one small, real task</h2>
              <p className={copy}>
                Use a copy or version-controlled branch of a project you
                understand. Choose one bounded change, such as adding validation
                to a form. Keep the same task and files when trying different
                tools; do not treat a scripted demo as a benchmark.
              </p>
              <blockquote className="mt-5 rounded-xl border border-line bg-paper-alt p-5 text-base leading-8 text-ink sm:p-6">
                Explain the relevant files first. Propose a short plan to add
                validation to this form. Make only the agreed change, run the
                relevant existing checks, and explain the result, remaining
                limitations, and how I can test it myself.
              </blockquote>
              <p className={copy}>
                Review whether it understood the request, kept changes focused,
                and explained the trade-offs. Read the actual command output:
                saying “tests passed” is not the same as showing a completed
                check. Try an invalid input yourself. If you cannot describe
                what changed, ask for a walkthrough before continuing.
              </p>
            </section>

            <section id="blue-workflow" className="scroll-mt-28">
              <h2 className={heading}>Use Blue in Windows or VS Code</h2>
              <p className={copy}>
                Blue is an AI coding assistant made specifically for students,
                with a Windows desktop app and a VS Code extension. Use it for
                code explanations, planning, and project work. Add a project
                folder when you want it to inspect files, edit code, or run
                relevant commands; a general chat does not need that access.
              </p>
              <p className={copy}>
                Install Blue Desktop through Microsoft Store, sign in with your
                email code, and choose a model provider in Setup Wizard. In VS
                Code, install the extension, open the Blue sidebar, and open
                your workspace folder. The command below installs the extension
                when the VS Code command-line tool is available.
              </p>
              <div className="mt-5"><DesktopDownloadLink className="btn btn-primary min-h-11"><Download size={16} aria-hidden="true" className="mr-2" />Download Blue for Windows</DesktopDownloadLink></div>
              <VSCodeInstallSnippet className="mt-6 !mx-0" />
              <p className={copy}>Follow the <Link href="/docs" className={link}>setup and project documentation</Link> for provider setup and troubleshooting. Keep API keys in Setup Wizard, not in chat messages.</p>
            </section>

            <section id="understand-the-cost" className="scroll-mt-28">
              <h2 className={heading}>Separate app access from model costs</h2>
              <p className={copy}>
                Blue Lite provides a free entry plan. That does not mean every
                model request is free or unlimited. With OpenRouter BYOK, you
                use your own provider key; the provider controls model charges,
                availability, and rate limits. Even a model marked free can be
                busy or rate limited.
              </p>
              <p className={copy}>
                The Blue subscription costs ₹{monthly.priceInr} for {monthly.days} days,
                ₹{quarterly.priceInr} for {quarterly.days} days, or
                ₹{yearly.priceInr.toLocaleString("en-IN")} for {yearly.days} days.
                These are prepaid access periods with no automatic renewal.
                Eligible paid features include multi-agent teams and additional
                integrations; provider usage is separate from the subscription.
              </p>
              <p className={copy}>
                Blue Pro offers selected premium models through Blue Credits.
                Its ₹100 starter trial provides one credit with no expiry;
                consumption varies by model and task. It is not an unlimited
                premium-model subscription. Check <Link href="/pricing" className={link}>current plans and pricing</Link>,
                then begin with a short task so you can understand usage before
                starting a larger project.
              </p>
            </section>

            <section id="learn-responsibly" className="scroll-mt-28">
              <h2 className={heading}>Keep learning—and keep responsibility</h2>
              <p className={copy}>
                Check your course or institution&apos;s AI policy before using an
                assistant for assessed work. Ask for hints, explanations, or
                feedback when completing the work yourself is required.
                Disclose assistance where required, and never present generated
                work as your own unaided work.
              </p>
              <p className={copy}>
                Do not share credentials, private student records, or data you
                lack permission to use. Review dependencies and changed files,
                run tests, and understand what you submit. No assistant can
                guarantee correctness, security, or compliance with your
                assignment rules. The useful outcome is not just working
                software—it is software you can explain and improve.
              </p>
              <Link href="/docs" className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-brand hover:underline">Start with Blue&apos;s documentation <ArrowRight size={16} aria-hidden="true" /></Link>
            </section>
          </div>
        </div>
      </article>
    </PageLayout>
  );
}
