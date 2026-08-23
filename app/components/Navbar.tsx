"use client";

import Link from "next/link";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="w-full glass py-4 px-6 border-b border-gray-800/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link prefetch={false} href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fa-solid fa-robot text-lg text-white"></i>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Blue AI</span>
            <span className="text-xs block text-gray-500 font-medium">Coding Agent</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link prefetch={false} href="/product/agents" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Agents
          </Link>
          <Link prefetch={false} href="/pricing" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Pricing
          </Link>
          <Link prefetch={false} href="/subscribe" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Subscribe
          </Link>
          <Link prefetch={false} href="/docs" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Docs
          </Link>
          <Link prefetch={false} href="/blog" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Blog
          </Link>
          <Link prefetch={false} href="/courses/java" className="text-sm font-medium text-orange-300 hover:text-orange-200 transition">
            Java Course
          </Link>
        </nav>

        <div className="flex items-center space-x-3">
          {user ? (
            <>
              <Link prefetch={false}
                href="/subscribe"
                className="hidden sm:inline-flex items-center px-4 py-1.5 rounded-lg border border-blue-800/50 text-sm font-semibold text-blue-400 hover:text-white hover:bg-blue-600/20 transition duration-200"
              >
                <i className="fa-solid fa-crown mr-1.5 text-[10px]"></i>
                Upgrade
              </Link>
              <Link prefetch={false}
                href="/console"
                className="hidden sm:inline-flex items-center px-4 py-1.5 rounded-lg border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition duration-200"
              >
                <i className="fa-solid fa-terminal mr-1.5 text-[10px]"></i>
                Console
              </Link>
            </>
          ) : (
            <>
              <Link prefetch={false}
                href="/subscribe"
                className="hidden sm:inline-flex items-center px-4 py-1.5 rounded-lg border border-blue-800/50 text-sm font-semibold text-blue-400 hover:text-white hover:bg-blue-600/20 transition duration-200"
              >
                <i className="fa-solid fa-crown mr-1.5 text-[10px]"></i>
                Upgrade
              </Link>
              <Link prefetch={false}
                href="/console"
                className="hidden sm:inline-flex items-center px-4 py-1.5 rounded-lg border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition duration-200"
              >
                Sign In
              </Link>
              <Link prefetch={false}
                href="/console"
                className="px-5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200"
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
