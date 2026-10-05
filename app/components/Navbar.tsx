"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Crown, Download, Menu, Terminal, X } from "lucide-react";
import DesktopDownloadLink from "./DesktopDownloadLink";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "./ThemeToggle";

const NAV_LINKS = [
  { href: "/product/agents", label: "Agents" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
];

export default function Navbar({ signedIn }: { signedIn?: boolean } = {}) {
  const { user } = useAuth();
  const showAccountLinks = signedIn ?? Boolean(user);
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
      <header className="sticky top-0 z-50 w-full border-b border-line bg-paper">
      <div className="site-container flex min-h-[76px] items-center justify-between gap-3 py-3">
        <Link prefetch={false} href="/" className="flex min-w-0 items-center gap-2.5">
          <Image src="/images/blue-symbol.png" alt="" width={38} height={38} unoptimized priority />
          <div className="min-w-0">
            <span className="block text-2xl font-display font-semibold tracking-tight text-ink">Blue</span>
            <span className="hidden text-[10px] text-ink-muted sm:block">by Imergene</span>
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
                className={`text-sm px-4 py-3 transition-colors duration-150 ${
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
            {showAccountLinks ? (
              <>
              <Link prefetch={false}
                href="/pricing"
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
                href="/console"
                className="btn btn-ghost !py-1.5"
              >
                Sign In
              </Link>
              </>
            )}
            <DesktopDownloadLink aria-label="Download Blue for Windows" className="btn btn-primary min-h-11 !py-1.5">
              <Download aria-hidden="true" className="mr-1.5 h-4 w-4 shrink-0" />
              Download Blue
            </DesktopDownloadLink>
          </div>

          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen(open => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-paper-alt text-ink transition hover:bg-paper-sunken lg:hidden"
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
            <div className="mt-4 border-t border-line pt-4">
              <DesktopDownloadLink onClick={() => setMobileMenuOpen(false)} className="btn btn-primary min-h-11 w-full justify-center !py-2.5">
                <Download aria-hidden="true" className="mr-2 h-4 w-4 shrink-0" />
                Download Blue for Windows
              </DesktopDownloadLink>
              <DesktopDownloadLink variant="store" onClick={() => setMobileMenuOpen(false)} className="mt-1 flex min-h-11 items-center justify-center text-xs text-ink-muted hover:text-brand">Open Microsoft Store</DesktopDownloadLink>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link prefetch={false} href="/pricing" onClick={() => setMobileMenuOpen(false)} className="btn btn-secondary justify-center !py-2.5">
                <Crown aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 text-accent" />
                Upgrade
              </Link>
              <Link prefetch={false} href="/console" onClick={() => setMobileMenuOpen(false)} className="btn btn-primary justify-center !py-2.5">
                {showAccountLinks ? <Terminal aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> : null}
                {showAccountLinks ? "Console" : "Get Started"}
              </Link>
            </div>
          </div>
        </div>
      )}
      </header>
    </>
  );
}
