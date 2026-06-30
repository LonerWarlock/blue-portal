import Link from "next/link";

const footerLinks = {
  Product: [
    { label: "Agents", href: "/product/agents" },
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
  ],
};

export default function Footer() {
  return (
    <footer className="w-full glass py-12 px-6 border-t border-gray-800/80">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <i className="fa-solid fa-robot text-xs text-white"></i>
              </div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Blue AI</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
              An applied research team focused on building the future of software development.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-gray-500 hover:text-gray-300 transition"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-gray-800/50 flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
          <span className="text-xs text-gray-600">
            &copy; 2026 Blue AI. All rights reserved.
          </span>
          <div className="flex items-center space-x-4">
            <a href="#" className="text-gray-600 hover:text-gray-400 transition">
              <i className="fa-brands fa-x-twitter"></i>
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-400 transition">
              <i className="fa-brands fa-github"></i>
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-400 transition">
              <i className="fa-brands fa-linkedin"></i>
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-400 transition">
              <i className="fa-brands fa-youtube"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
