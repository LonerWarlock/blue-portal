"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "./ThemeToggle";

const NAV_LINKS = [
  { href: "/product/agents", label: "Agents" },
  { href: "/pricing", label: "Pricing" },
  { href: "/subscribe", label: "Subscribe" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
];

export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <header className="w-full bg-paper py-4 px-6 border-b border-line sticky top-0 z-50 shadow-soft">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link prefetch={false} href="/" className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center">
            <i className="fa-solid fa-robot text-sm text-white"></i>
          </div>
          <div>
            <span className="text-lg font-display font-bold tracking-tight text-ink">Blue AI</span>
            <span className="eyebrow block leading-none mt-0.5">Coding Agent</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                prefetch={false}
                href={link.href}
                className={`text-sm px-3 py-1.5 transition-colors duration-150 ${
                  isActive
                    ? "nav-link-active font-medium"
                    : "text-ink-muted hover:text-ink rounded-md"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center space-x-3">
          <ThemeToggle />
          {user ? (
            <>
              <Link prefetch={false}
                href="/subscribe"
                className="btn btn-secondary hidden sm:inline-flex !py-1.5"
              >
                <i className="fa-solid fa-crown mr-1.5 text-[10px] text-accent"></i>
                Upgrade
              </Link>
              <Link prefetch={false}
                href="/console"
                className="btn btn-ghost hidden sm:inline-flex !py-1.5"
              >
                <i className="fa-solid fa-terminal mr-1.5 text-[10px]"></i>
                Console
              </Link>
            </>
          ) : (
            <>
              <Link prefetch={false}
                href="/subscribe"
                className="btn btn-secondary hidden sm:inline-flex !py-1.5"
              >
                <i className="fa-solid fa-crown mr-1.5 text-[10px] text-accent"></i>
                Upgrade
              </Link>
              <Link prefetch={false}
                href="/console"
                className="btn btn-ghost hidden sm:inline-flex !py-1.5"
              >
                Sign In
              </Link>
              <Link prefetch={false}
                href="/console"
                className="btn btn-primary !py-1.5"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
