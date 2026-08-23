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
    { label: "Java Course", href: "/courses/java" },
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
    <footer className="w-full glass py-8 px-6 border-t border-gray-800/80">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-x-12 gap-y-6 mb-6">
          <div className="flex items-center gap-2 mr-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <i className="fa-solid fa-robot text-[10px] text-white"></i>
            </div>
            <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Blue AI</span>
          </div>
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{category}</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {links.map((link) => (
                  <Link prefetch={false}
                    key={link.label}
                    href={link.href}
                    className="text-xs text-gray-500 hover:text-gray-300 transition whitespace-nowrap"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-800/50 flex flex-col md:flex-row justify-between items-center gap-2">
          <div className="text-[10px] text-gray-600 text-center md:text-left">
            &copy; 2026 Blue AI. All rights reserved. Owned and operated by IMERGENE.
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="text-gray-600 hover:text-gray-400 transition text-xs">
              <i className="fa-brands fa-x-twitter"></i>
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-400 transition text-xs">
              <i className="fa-brands fa-github"></i>
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-400 transition text-xs">
              <i className="fa-brands fa-linkedin"></i>
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-400 transition text-xs">
              <i className="fa-brands fa-youtube"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
