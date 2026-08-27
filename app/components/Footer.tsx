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
    <footer className="w-full bg-paper-alt py-10 px-6 border-t border-line">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-x-12 gap-y-6 mb-8">
          <div className="flex items-center gap-2 mr-4">
            <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center shrink-0">
              <i className="fa-solid fa-robot text-[10px] text-white"></i>
            </div>
            <span className="text-sm font-display font-bold tracking-tight text-ink">Blue AI</span>
          </div>
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="eyebrow mb-2">{category}</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {links.map((link) => (
                  <Link prefetch={false}
                    key={link.label}
                    href={link.href}
                    className="text-xs text-ink-muted hover:text-ink transition-colors duration-150 whitespace-nowrap"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-line flex flex-col md:flex-row justify-between items-center gap-2">
          <div className="text-xs text-ink-faint text-center md:text-left">
            &copy; 2026 Blue AI. All rights reserved. Owned and operated by IMERGENE.
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="text-ink-faint hover:text-ink-muted transition-colors duration-150 text-xs">
              <i className="fa-brands fa-x-twitter"></i>
            </a>
            <a href="#" className="text-ink-faint hover:text-ink-muted transition-colors duration-150 text-xs">
              <i className="fa-brands fa-github"></i>
            </a>
            <a href="#" className="text-ink-faint hover:text-ink-muted transition-colors duration-150 text-xs">
              <i className="fa-brands fa-linkedin"></i>
            </a>
            <a href="#" className="text-ink-faint hover:text-ink-muted transition-colors duration-150 text-xs">
              <i className="fa-brands fa-youtube"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
