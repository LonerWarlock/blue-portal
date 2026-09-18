'use client';

import { useCookieConsent } from '../contexts/CookieConsentContext';
import Link from 'next/link';

export default function CookieConsentBanner() {
  const { hasChosen, acceptAll, acceptEssential } = useCookieConsent();

  if (hasChosen) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-4 animate-[slideUp_0.4s_ease-out]"
    >
      <div className="max-w-2xl mx-auto rounded-xl bg-paper border border-line shadow-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 mt-0.5">
            <i className="fa-solid fa-cookie-bite text-brand text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink mb-1">We value your privacy</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              We use cookies and similar technologies to improve your experience, analyse site usage, and assist in our marketing efforts.
              You can choose to accept all cookies or only essential ones.{' '}
              <Link href="/privacy" className="text-brand hover:underline">
                Read our Privacy Policy
              </Link>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <button
            onClick={acceptAll}
            className="flex-1 px-4 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold shadow transition hover:opacity-90"
          >
            Accept All
          </button>
          <button
            onClick={acceptEssential}
            className="flex-1 px-4 py-2.5 rounded-lg border border-line bg-paper-alt text-ink-muted text-sm font-semibold transition hover:text-ink hover:border-line-strong"
          >
            Essential Only
          </button>
        </div>

        <p className="text-[10px] text-ink-faint mt-3 text-center">
          Essential cookies are required for the site to function (e.g. theme preference). Analytics and marketing cookies are only loaded with your consent.
        </p>
      </div>
    </div>
  );
}
