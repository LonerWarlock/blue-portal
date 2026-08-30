import Link from "next/link";

const footerLinks = {
  Product: [
    { label: "Agents", href: "/product/agents" },
    { label: "Services", href: "/services" },
    { label: "Subscription", href: "/subscribe" },
    { label: "Enterprise", href: "/enterprise" },
    { label: "Pricing", href: "/pricing" },
  ],
  Resources: [
    { label: "Documentation", href: "/docs" },
    { label: "Changelog", href: "/changelog" },
    { label: "Community", href: "/community" },
    { label: "Status", href: "/status" },
  ],
  Company: [
    { label: "Careers", href: "/careers" },
    { label: "Blog", href: "/blog" },
    { label: "Security", href: "/security" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "/contact" },
    { label: "Refund", href: "/refund" },
  ],
};

export default function Footer() {
  return (
    <footer className="w-full bg-paper-alt px-6 py-12 border-t border-line">
      <div className="max-w-7xl mx-auto">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.25fr_repeat(3,minmax(0,1fr))]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center shrink-0">
                <i className="fa-solid fa-robot text-xs text-white"></i>
              </div>
              <div>
                <span className="block text-base font-display font-bold tracking-tight text-ink">Blue AI</span>
                <span className="eyebrow block leading-none mt-1">Coding Agent</span>
              </div>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-ink-muted">
              Affordable autonomous coding agents that plan, build, test, and improve your software.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="eyebrow mb-4">{category}</h4>
              <nav aria-label={`${category} links`} className="flex flex-col items-start gap-2.5">
                {links.map((link) => (
                  <Link
                    prefetch={false}
                    key={link.label}
                    href={link.href}
                    className="text-sm text-ink-muted hover:text-ink transition-colors duration-150"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-line flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs text-ink-faint text-center md:text-left">
            &copy; 2026 Blue AI. All rights reserved. Owned and operated by IMERGENE.
          </div>
          <div className="flex items-center gap-4">
            <a href="#" aria-label="GitHub" className="text-ink-faint hover:text-ink transition-colors duration-150 text-sm">
              <i className="fa-brands fa-github"></i>
            </a>
            <a href="#" aria-label="LinkedIn" className="text-ink-faint hover:text-ink transition-colors duration-150 text-sm">
              <i className="fa-brands fa-linkedin"></i>
            </a>
            <a href="#" aria-label="YouTube" className="text-ink-faint hover:text-ink transition-colors duration-150 text-sm">
              <i className="fa-brands fa-youtube"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
