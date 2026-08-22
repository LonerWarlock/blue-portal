"use client";

import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="w-full bg-paper py-4 px-6 border-b border-line sticky top-0 z-50">
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
        <nav className="hidden md:flex items-center space-x-8">
          <Link prefetch={false} href="/product/agents" className="text-sm text-ink-muted hover:text-ink transition-colors duration-150">
            Agents
          </Link>
          <Link prefetch={false} href="/pricing" className="text-sm text-ink-muted hover:text-ink transition-colors duration-150">
            Pricing
          </Link>
          <Link prefetch={false} href="/subscribe" className="text-sm text-ink-muted hover:text-ink transition-colors duration-150">
            Subscribe
          </Link>
          <Link prefetch={false} href="/docs" className="text-sm text-ink-muted hover:text-ink transition-colors duration-150">
            Docs
          </Link>
          <Link prefetch={false} href="/blog" className="text-sm text-ink-muted hover:text-ink transition-colors duration-150">
            Blog
          </Link>
        </nav>

        <div className="flex items-center space-x-3">
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
