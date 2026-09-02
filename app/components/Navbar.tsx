"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Crown, Menu, Terminal, X } from "lucide-react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => setMobileMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-terminal/20 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <header className="sticky top-0 z-50 w-full border-b border-line bg-paper shadow-soft">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link prefetch={false} href="/" className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand">
            <Bot aria-hidden="true" className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-base font-display font-bold tracking-tight text-ink sm:text-lg">Blue AI</span>
            <span className="eyebrow hidden leading-none mt-0.5 sm:block">Coding Agent</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-1" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                prefetch={false}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`text-sm px-3 py-1.5 transition-colors duration-150 ${
                  active
                    ? "nav-link-active font-medium"
                    : "text-ink-muted hover:text-ink rounded-md"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />

          <div className="hidden items-center gap-3 lg:flex">
            {user ? (
              <>
              <Link prefetch={false}
                href="/subscribe"
                className="btn btn-secondary !py-1.5"
              >
                <Crown aria-hidden="true" className="mr-1.5 h-3 w-3 text-accent" />
                Upgrade
              </Link>
              <Link prefetch={false}
                href="/console"
                className="btn btn-ghost !py-1.5"
              >
                <Terminal aria-hidden="true" className="mr-1.5 h-3 w-3" />
                Console
              </Link>
              </>
            ) : (
              <>
              <Link prefetch={false}
                href="/subscribe"
                className="btn btn-secondary !py-1.5"
              >
                <Crown aria-hidden="true" className="mr-1.5 h-3 w-3 text-accent" />
                Upgrade
              </Link>
              <Link prefetch={false}
                href="/console"
                className="btn btn-ghost !py-1.5"
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

          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen(open => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-paper-alt text-ink transition hover:bg-paper-sunken lg:hidden"
          >
            {mobileMenuOpen
              ? <X aria-hidden="true" className="h-4 w-4" />
              : <Menu aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div id="mobile-navigation" className="absolute left-0 right-0 top-full border-b border-line bg-paper shadow-elevated lg:hidden">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  prefetch={false}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-md px-3 py-3 text-sm font-medium transition-colors ${
                    isActive(link.href) ? "bg-brand/10 text-brand" : "text-ink-muted hover:bg-paper-alt hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
              <Link prefetch={false} href="/subscribe" onClick={() => setMobileMenuOpen(false)} className="btn btn-secondary justify-center !py-2.5">
                <Crown aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 text-accent" />
                Upgrade
              </Link>
              <Link prefetch={false} href="/console" onClick={() => setMobileMenuOpen(false)} className="btn btn-primary justify-center !py-2.5">
                {user ? <Terminal aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> : null}
                {user ? "Console" : "Get Started"}
              </Link>
            </div>
          </div>
        </div>
      )}
      </header>
    </>
  );
}
