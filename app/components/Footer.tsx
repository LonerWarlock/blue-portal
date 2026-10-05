"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import DesktopDownloadLink from "./DesktopDownloadLink";
import { useCookieConsent } from "../contexts/CookieConsentContext";

const footerLinks = {
  Product: [
    { label: "Agents", href: "/product/agents" },
    { label: "Pricing", href: "/pricing" },
    { label: "Services", href: "/services" },
    { label: "Enterprise", href: "/enterprise" },
  ],
  Resources: [
    { label: "Documentation", href: "/docs" },
    { label: "Student coding guide", href: "/guides/ai-coding-assistant-for-students" },
    { label: "Changelog", href: "/changelog" },
    { label: "Community", href: "/community" },
    { label: "Status", href: "/status" },
  ],
  Company: [
    { label: "About Blue by Imergene", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
    { label: "Security", href: "/security" },
    { label: "Privacy & DPDP", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Refund policy", href: "/refund" },
  ],
};

export default function Footer() {
  const { resetConsent } = useCookieConsent();
  return (
    <footer className="site-footer border-t border-line bg-paper-alt">
      <div className="site-container py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Blue home"><Image src="/images/blue-symbol.png" alt="" width={40} height={40} unoptimized /><span className="font-display text-2xl font-semibold tracking-tight">Blue<span className="ml-3 text-xs font-sans font-normal text-ink-muted">by Imergene</span></span></Link>
            <p className="mt-5 max-w-xs text-sm leading-7 text-ink-muted">Made specifically for students.<br />An AI coding workspace for the ideas you want to bring to life.</p>
            <DesktopDownloadLink className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs text-brand hover:underline">Download Blue for Windows <ArrowUpRight size={14} aria-hidden="true" /></DesktopDownloadLink>
          </div>
          {Object.entries(footerLinks).map(([category, links]) => <div key={category}><h3 className="eyebrow mb-4">{category}</h3><nav aria-label={`${category} links`} className="flex flex-col items-start">{links.map(link => <Link prefetch={false} key={link.label} href={link.href} className="inline-flex min-h-10 items-center text-sm text-ink-muted hover:text-ink">{link.label}</Link>)}{category === "Company" && <button type="button" onClick={resetConsent} className="min-h-10 text-left text-sm text-ink-muted hover:text-ink">Cookie preferences</button>}</nav></div>)}
        </div>
        <div className="mt-14 flex flex-col gap-5 border-t border-line pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Blue. Owned and operated by IMERGENE.</p>
          <a href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 hover:text-brand">Find Blue on Visual Studio Marketplace <ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  );
}
