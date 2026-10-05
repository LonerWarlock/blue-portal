import PageLayout from "@/app/components/PageLayout";
import AgentLiveDemo from "@/app/components/AgentLiveDemo";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata("/product/agents", "Blue AI Coding Agents | Build, Debug and Test Projects", "Use Blue coding agents to understand projects, plan changes, edit code and run relevant checks. Explore a demonstration and learn how to get started.");

export default function AgentsPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line-strong bg-paper eyebrow mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
              Product
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Let AI code for you
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                while you think
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Blue&apos;s AI coding agents work with your project: explain code, plan changes,
              edit files and run relevant checks. Review the result before you use it.
            </p>
          </div>

          {/* Watch Blue work — real product demo */}
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
              <p className="text-sm text-ink-muted">Safe sandboxed terminal execution that runs locally on your machine.</p>
            </div>
            <div className="p-6 rounded-lg panel border border-line">
              <div className="w-12 h-12 rounded-lg bg-brand flex items-center justify-center mb-5">
                <i className="fa-solid fa-eye text-lg text-white"></i>
              </div>
              <h3 className="text-lg font-bold text-ink mb-3">Independent Review</h3>
              <p className="text-sm text-ink-muted">Ask the agent to review its changes and run relevant checks. AI output can contain mistakes; always inspect the diff and test the result.</p>
            </div>
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
