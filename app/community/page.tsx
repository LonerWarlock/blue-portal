import PageLayout from "@/app/components/PageLayout";
import Link from "next/link";

const platforms = [
  {
    name: "Discord Server",
    description: "Join our active server to chat with developers, share your automated agent scripts, and ask questions.",
    icon: "fa-brands fa-discord",
    href: "#",
    gradient: "from-indigo-500 to-purple-500",
    cta: "Join Discord",
  },
  {
    name: "GitHub Discussions",
    description: "Report bugs, participate in design decisions, and request new models.",
    icon: "fa-brands fa-github",
    href: "#",
    gradient: "from-gray-600 to-gray-400",
    cta: "Start Discussion",
  },
  {
    name: "Community Forums",
    description: "Read tutorials written by other developers on how they use Blue to automate their daily workflows.",
    icon: "fa-solid fa-comments",
    href: "#",
    gradient: "from-blue-500 to-cyan-500",
    cta: "Visit Forums",
  },
];

export default function CommunityPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-800/50 text-blue-400 text-xs font-semibold mb-8">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Community
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Join the developer
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                community
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Connect with other builders, request features, and get support.
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {platforms.map((platform) => (
              <div
                key={platform.name}
                className="p-6 rounded-2xl glass border border-gray-800/80 hover:border-gray-700/80 transition duration-300 flex flex-col"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center mb-5`}>
                  <i className={`${platform.icon} text-lg text-white`}></i>
                </div>
                <h3 className="text-lg font-bold text-gray-100 mb-3">{platform.name}</h3>
                <p className="text-sm text-gray-400 leading-relaxed flex-1 mb-6">{platform.description}</p>
                <Link
                  href={platform.href}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white hover:from-blue-500 hover:to-indigo-500 transition duration-200"
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
