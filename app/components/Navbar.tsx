"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <header className="w-full glass py-4 px-6 border-b border-gray-800/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-3">
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
          <Link href="/#features" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Features
          </Link>
          <Link href="/#models" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Models
          </Link>
          <Link href="/#testimonials" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Testimonials
          </Link>
          <Link href="/pricing" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Pricing
          </Link>
          <Link href="/docs" className="text-sm text-gray-400 hover:text-gray-200 transition">
            Docs
          </Link>
        </nav>

        <div className="flex items-center space-x-3">
          <Link
            href="/console"
            className="hidden sm:inline-flex px-4 py-1.5 rounded-lg border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition duration-200"
          >
            Sign In
          </Link>
          <Link
            href="/console"
            className="px-5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
