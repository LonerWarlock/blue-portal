import type { Metadata } from "next";
import Link from "next/link";
import PageLayout from "@/app/components/PageLayout";

export const metadata: Metadata = {
  title: "Blue Documentation",
  description:
    "Set up Blue Desktop or the VS Code extension, work with projects and models, use UI Max, and troubleshoot common issues.",
};

const sections = [
  { id: "get-started", label: "Get started" },
  { id: "projects", label: "Projects and chats" },
  { id: "models", label: "Models and billing" },
  { id: "modes", label: "Full Access and UI Max" },
  { id: "connections", label: "Connections" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const card = "rounded-2xl border border-line bg-paper p-6";
const heading = "text-xl font-semibold tracking-tight text-ink";
const copy = "mt-3 text-sm leading-7 text-ink-muted";

export default function DocsPage() {
  return (
    <PageLayout>
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-16 lg:pt-20">
        <div className="max-w-3xl">
          <p className="eyebrow text-brand">BLUE DOCUMENTATION</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Use Blue with confidence
          </h1>
          <p className="mt-5 text-lg leading-8 text-ink-muted">
            Set up a model connection, give Blue a project to work on, and follow
            its progress. This guide covers Blue Desktop and the VS Code
            extension as they work today.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Documentation sections" className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              On this page
            </p>
            <ul className="space-y-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-paper-sunken hover:text-ink"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
            <Link href="/contact" className="mt-5 block px-3 text-sm font-medium text-brand hover:underline">
              Need help? Contact us
            </Link>
          </nav>

          <div className="min-w-0 space-y-12">
            <section id="get-started" className="scroll-mt-28">
              <h2 className="text-2xl font-bold text-ink">Get started</h2>
              <p className={copy}>
                Blue needs an internet connection and a model provider. Sign in
                to your Blue account before choosing how model requests are paid
                for. You can change the provider later in Setup Wizard.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className={card}>
                  <h3 className={heading}>Blue Desktop</h3>
                  <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-7 text-ink-muted">
                    <li>Install Blue Desktop from an official Blue release or a test package provided by the team.</li>
                    <li>Sign in using the email code sent to your Blue account.</li>
                    <li>In Setup Wizard, choose OpenRouter BYOK and paste your own API key, or choose Blue models if your account has eligible Blue Pro credits.</li>
                    <li>Select a model, add a project folder if you want file changes, and send your first prompt.</li>
                  </ol>
                </div>
                <div className={card}>
                  <h3 className={heading}>VS Code extension</h3>
                  <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-7 text-ink-muted">
                    <li>
                      Install{" "}
                      <a
                        href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant"
                        className="font-medium text-brand hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Blue Coding Assistant
                      </a>{" "}
                      from the VS Code Marketplace.
                    </li>
                    <li>Open the Blue sidebar, sign in, and complete the Setup Wizard with the provider option available to your account.</li>
                    <li>Open a workspace folder in VS Code, select a model, and ask Blue to inspect or change your project.</li>
                  </ol>
                </div>
              </div>
              <p className={copy}>
                For OpenRouter BYOK, create a key on{" "}
                <a
                  href="https://openrouter.ai/settings/keys"
                  className="font-medium text-brand hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenRouter&apos;s key page
                </a>
                . Enter it in Setup Wizard, not in a chat message.
              </p>
            </section>

            <section id="projects" className="scroll-mt-28">
              <h2 className="text-2xl font-bold text-ink">Projects and chats</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className={card}>
                  <h3 className={heading}>General chat</h3>
                  <p className={copy}>
                    Use New chat for questions, explanations, and planning that
                    do not need access to a local folder.
                  </p>
                </div>
                <div className={card}>
                  <h3 className={heading}>Project work</h3>
                  <p className={copy}>
                    Add a project folder before asking Blue to inspect files,
                    edit code, run commands, or test an app. Review the activity
                    and changed files before accepting the result.
                  </p>
                </div>
              </div>
              <p className={copy}>
                In Desktop, use <kbd className="font-mono text-ink">Ctrl N</kbd> for
                a new chat, <kbd className="font-mono text-ink">Ctrl O</kbd> to open
                a folder, and <kbd className="font-mono text-ink">Ctrl K</kbd> for
                search. Press Enter to send a message and Shift Enter for a new
                line. You can attach files or images from the composer; a model
                may need image support to understand an image directly.
              </p>
            </section>

            <section id="models" className="scroll-mt-28">
              <h2 className="text-2xl font-bold text-ink">Models and billing</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className={card}>
                  <h3 className={heading}>OpenRouter BYOK</h3>
                  <p className={copy}>
                    Blue uses your OpenRouter key. OpenRouter controls that
                    account&apos;s model availability, charges, and rate limits.
                    A model marked free can still be busy or rate limited.
                  </p>
                </div>
                <div className={card}>
                  <h3 className={heading}>Blue models</h3>
                  <p className={copy}>
                    Eligible Blue Pro accounts can use Blue Credits instead of
                    entering a personal provider key. Paid-model usage varies
                    by model and task. Check your balance before longer runs.
                  </p>
                </div>
              </div>
              <p className={copy}>
                Model prices and availability can change. Check the model picker
                before starting a task and see the current{" "}
                <Link href="/pricing" className="font-medium text-brand hover:underline">
                  plans and pricing
                </Link>{" "}
                for Blue subscription and credit options. Blue&apos;s subscription
                does not remove limits imposed on your own BYOK account.
              </p>
            </section>

            <section id="modes" className="scroll-mt-28">
              <h2 className="text-2xl font-bold text-ink">Full Access and UI Max</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className={card}>
                  <h3 className={heading}>Full Access</h3>
                  <p className={copy}>
                    Allows ordinary local workspace actions with fewer approval
                    prompts. Secrets, protected files, deployments, and other
                    external actions can still require your approval. Enable it
                    only for a project you trust.
                  </p>
                </div>
                <div className={card}>
                  <h3 className={heading}>UI Max</h3>
                  <p className={copy}>
                    Use it for frontend project work when you want extra design,
                    image analysis, and browser-based visual refinement. It can
                    take longer and consume provider tokens or Blue Credits
                    faster. A browser review is evidence only when it actually
                    completes.
                  </p>
                </div>
              </div>
            </section>

            <section id="connections" className="scroll-mt-28">
              <h2 className="text-2xl font-bold text-ink">Connections</h2>
              <p className={copy}>
                Open Connections in Blue Desktop to connect your own service
                accounts. GitHub MCP is free and read-only. Vercel and Canva
                connections require an eligible Blue or Blue Pro plan, plus
                authorization from the service itself. Available actions depend
                on the connected account&apos;s permissions.
              </p>
              <p className={copy}>
                A connected service can have its own quotas. For example, Canva
                AI design generation may use Canva credits and can fail when
                that account&apos;s quota is exhausted. Disconnect a service you
                no longer want Blue to use.
              </p>
            </section>

            <section id="troubleshooting" className="scroll-mt-28">
              <h2 className="text-2xl font-bold text-ink">Troubleshooting</h2>
              <div className="mt-5 space-y-4">
                <div className={card}>
                  <h3 className={heading}>A model is rate limited or unavailable</h3>
                  <p className={copy}>
                    A 429 error usually means the provider or selected model is
                    limiting requests. Wait and retry, or choose another model.
                    With BYOK, check your own provider account&apos;s limits.
                  </p>
                </div>
                <div className={card}>
                  <h3 className={heading}>Blue cannot continue a task</h3>
                  <p className={copy}>
                    Open the technical details to identify whether the problem
                    is a model, connection, permission, or local runtime issue.
                    Check any completed work before retrying the saved chat.
                    A failed step does not mean that all earlier file changes
                    were undone.
                  </p>
                </div>
                <div className={card}>
                  <h3 className={heading}>A connection is not working</h3>
                  <p className={copy}>
                    Refresh its status, confirm the correct Blue plan and
                    provider account, then reconnect if authorization expired.
                    Provider-side permissions and quotas still apply.
                  </p>
                </div>
              </div>
              <p className={copy}>
                Still stuck?{" "}
                <Link href="/contact" className="font-medium text-brand hover:underline">
                  Contact Blue support
                </Link>{" "}
                with the error text, selected model, app version, and what you
                asked Blue to do. Do not include API keys or passwords.
              </p>
            </section>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
