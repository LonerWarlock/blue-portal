import Link from "next/link";
import PageLayout from "@/app/components/PageLayout";

const guides = [
  {
    href: "/guides/ai-coding-assistant-for-students",
    title: "Using an AI coding assistant as a student",
    description: "A practical starting point for learning, project work and reviewing AI-generated changes.",
  },
  {
    href: "/guides/ai-agent-teams",
    title: "Working with AI agent teams",
    description: "Learn how Desktop Team mode coordinates project work, and which plan, permissions and local-running requirements apply.",
  },
  {
    href: "/docs",
    title: "Blue setup and documentation",
    description: "Install Blue, connect a model provider and understand project access and model-usage costs.",
  },
];

export default function BlogPage() {
  return (
    <PageLayout>
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-20">
        <p className="eyebrow text-brand">BLUE GUIDES</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink sm:text-5xl">Read the published guides</h1>
        <p className="mt-6 text-lg leading-8 text-ink-muted">There are no separate blog articles published here yet. These guides and documentation pages are available now.</p>
        <div className="mt-10 space-y-4">
          {guides.map((guide) => (
            <article key={guide.href} className="rounded-2xl border border-line bg-paper p-6">
              <h2 className="text-xl font-semibold text-ink"><Link href={guide.href} className="text-brand hover:underline">{guide.title}</Link></h2>
              <p className="mt-3 text-sm leading-7 text-ink-muted">{guide.description}</p>
            </article>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
