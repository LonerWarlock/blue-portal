import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const platforms = [
  {
    name: "Discord Server",
    description: "Join our active server to chat with developers, share your automated agent scripts, and ask questions.",
    icon: "fa-brands fa-discord",
    href: "#",
    gradient: "from-brand to-brand",
    cta: "Join Discord",
  },
  {
    name: "GitHub Discussions",
    description: "Report bugs, participate in design decisions, and request new models.",
    icon: "fa-brands fa-github",
    href: "#",
    gradient: "from-brand to-brand",
    cta: "Start Discussion",
  },
  {
    name: "Community Forums",
    description: "Read tutorials written by other developers on how they use Blue to automate their daily workflows.",
    icon: "fa-solid fa-comments",
    href: "#",
    gradient: "from-brand to-brand",
    cta: "Visit Forums",
  },
];

export default function CommunityPage() {
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
              Community
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-ink">
                Join the developer
              </span>
              <br />
              <span className="bg-brand bg-clip-text text-transparent">
                community
              </span>
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-3xl mx-auto leading-relaxed">
              Connect with other builders, request features, and get support.
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {platforms.map((platform) => (
              <div
                key={platform.name}
                className="p-6 rounded-lg panel border border-line hover:border-line-strong transition duration-300 flex flex-col"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${platform.gradient} flex items-center justify-center mb-5`}>
                  <i className={`${platform.icon} text-lg text-white`}></i>
                </div>
                <h3 className="text-lg font-bold text-ink mb-3">{platform.name}</h3>
                <p className="text-sm text-ink-muted leading-relaxed flex-1 mb-6">{platform.description}</p>
                <Link
                  href={platform.href}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-sm font-semibold text-white transition duration-200"
                >
                  {platform.cta}
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
