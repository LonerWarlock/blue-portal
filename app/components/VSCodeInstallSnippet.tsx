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
      {/* Clean minimal terminal command pill */}
      <div className="group relative flex items-center justify-between gap-3 bg-gray-900/90 border border-gray-800 hover:border-gray-700 rounded-xl px-4 py-2.5 shadow-xl backdrop-blur-md transition-all">
        <div className="flex items-center gap-3 overflow-x-auto font-mono text-xs sm:text-sm text-gray-300 scrollbar-none py-0.5">
          <span className="text-gray-500 font-bold select-none">$</span>
          <code className="text-gray-200 font-mono tracking-tight select-all">{command}</code>
        </div>
        <button
          onClick={handleCopy}
          title="Copy command"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700/60 text-xs font-medium transition active:scale-95"
        >
          <i className={`fa-solid ${copied ? 'fa-check text-emerald-400' : 'fa-copy text-gray-400'}`} />
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Subtle humanic secondary text links */}
      <div className="mt-2.5 flex items-center justify-center gap-4 text-xs text-gray-400 font-medium">
        <a
          href={vscodeDeepLink}
          className="hover:text-blue-400 transition flex items-center gap-1"
        >
          <span>Open in VS Code</span>
          <i className="fa-solid fa-arrow-right text-[10px]" />
        </a>
        <span className="text-gray-700 font-normal">•</span>
        <a
          href={marketplaceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-400 transition flex items-center gap-1"
        >
          <span>Marketplace</span>
          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
        </a>
      </div>
    </div>
  );
}
