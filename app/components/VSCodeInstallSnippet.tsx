'use client';

import { useState } from 'react';

export default function VSCodeInstallSnippet({ className = '' }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const command = 'code --install-extension om-mali.blue-coding-assistant';
  const vscodeDeepLink = 'vscode:extension/om-mali.blue-coding-assistant';
  const marketplaceUrl = 'https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`w-full max-w-xl mx-auto ${className}`}>
      {/* Clean minimal terminal command pill — intentionally always a dark
          terminal surface, independent of the light/dark theme toggle, so
          the white command text stays readable in both themes. */}
      <div className="group relative flex items-center justify-between gap-3 bg-[#172033] border border-[#172033]/80 hover:border-[#667085] rounded-md px-4 py-2.5 transition-colors duration-150">
        <div className="flex items-center gap-3 overflow-x-auto font-mono text-xs sm:text-sm text-white/90 scrollbar-none py-0.5">
          <span className="text-white/50 font-bold select-none">$</span>
          <code className="text-white font-mono tracking-tight select-all">{command}</code>
        </div>
        <button
          onClick={handleCopy}
          title="Copy command"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white border border-white/10 text-xs font-medium transition-colors duration-150"
        >
          <i className={`fa-solid ${copied ? 'fa-check text-success' : 'fa-copy'}`} />
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Subtle secondary text links */}
      <div className="mt-2.5 flex items-center justify-center gap-4 text-xs text-ink-muted font-medium">
        <a
          href={vscodeDeepLink}
          className="hover:text-brand transition-colors duration-150 flex items-center gap-1"
        >
          <span>Open in VS Code</span>
          <i className="fa-solid fa-arrow-right text-[10px]" />
        </a>
        <span className="text-line-strong">•</span>
        <a
          href={marketplaceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand transition-colors duration-150 flex items-center gap-1"
        >
          <span>Marketplace</span>
          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
        </a>
      </div>
    </div>
  );
}
