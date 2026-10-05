import Link from "next/link";
import { ChevronDown } from "lucide-react";
import DesktopDownloadLink from "./DesktopDownloadLink";
import VSCodeInstallSnippet from "./VSCodeInstallSnippet";
import { BLUE_SUBSCRIPTION_PLANS } from "@/lib/blueSubscriptionPlans";

const link = "font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand";

export default function CodingAssistantFaq() {
  const { monthly, quarterly, yearly } = BLUE_SUBSCRIPTION_PLANS;
  const questions = [
    {
      question: "What is Blue?",
      answer: <p>Blue is an AI coding assistant made specifically for students. It brings code explanations, conversations, and project work into a Windows desktop app and a VS Code extension.</p>,
    },
    {
      question: "How can Blue help with student projects?",
      answer: <p>Ask Blue to explain unfamiliar code, plan a feature, inspect a project, or help debug a problem. Review its changes and ask why they work. Follow your course&apos;s AI policy for assessed work. Our <Link href="/guides/ai-coding-assistant-for-students" className={link}>student guide</Link> includes a practical task for evaluating an assistant.</p>,
    },
    {
      question: "Where can I install Blue?",
      answer: <div className="space-y-4"><p><DesktopDownloadLink className={link}>Download Blue Desktop for Windows</DesktopDownloadLink> through Microsoft, or install Blue Coding Assistant in VS Code. If the VS Code command-line tool is available, use this command:</p><VSCodeInstallSnippet className="!mx-0" /><p>Then sign in, choose a model provider, and open your project folder. See the <Link href="/docs" className={link}>setup documentation</Link>.</p></div>,
    },
    {
      question: "Is Blue free, and are model requests included?",
      answer: <p>Blue Lite is a free entry plan. With OpenRouter BYOK, model usage is billed by your provider to your own key, where applicable. Free models can still have rate limits. Blue Pro uses Blue Credits for selected premium models; free app access does not mean unlimited free premium inference.</p>,
    },
    {
      question: "What does the Blue subscription cost?",
      answer: <p>Blue costs ₹{monthly.priceInr} for {monthly.days} days, ₹{quarterly.priceInr} for {quarterly.days} days, or ₹{yearly.priceInr.toLocaleString("en-IN")} for {yearly.days} days. These are prepaid access periods with no auto-renewal. Model-provider costs remain separate. Compare eligible features and Blue Pro credits on the <Link href="/pricing" className={link}>pricing page</Link>.</p>,
    },
    {
      question: "Can Blue run tests, and does it guarantee correct code?",
      answer: <p>With a project folder, Blue can run relevant commands and checks using your local tools, subject to permissions and availability. Read the actual results and review changed files. AI-generated code can be wrong; a failed or uncompleted check is not a passing test, and no assistant guarantees correctness or security.</p>,
    },
  ];

  return (
    <section className="border-t border-line py-16 sm:py-24" aria-labelledby="coding-assistant-faq-title">
      <div className="site-container grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        <div>
          <p className="eyebrow">A clearer starting point</p>
          <h2 id="coding-assistant-faq-title" className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Questions about Blue.</h2>
          <p className="mt-4 max-w-md text-base leading-7 text-ink-muted">The essentials: how to start, how costs work, and how to keep your project in your hands.</p>
        </div>
        <div className="min-w-0 divide-y divide-line border-y border-line">
          {questions.map(({ question, answer }) => (
            <details key={question} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-medium text-ink [&::-webkit-details-marker]:hidden">
                <span>{question}</span><ChevronDown size={17} aria-hidden="true" className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="pb-6 text-sm leading-7 text-ink-muted">{answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
