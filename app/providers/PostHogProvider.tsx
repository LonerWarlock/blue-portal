'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { analytics } from '@/lib/optionalAnalytics';

export function PostHogPageView() {
  const pathname = usePathname();
  const { consent } = useCookieConsent();

  useEffect(() => {
    analytics.setConsent(consent === 'all');
    if (consent === 'all' && pathname) {
      void analytics.trackPageView(window.location.origin + pathname);
    }
  }, [pathname, consent]);

  useEffect(() => {
    return () => analytics.setConsent(false);
  }, []);

  // A renderless sibling, never an ancestor of route content or auth/payment UI.
  return null;
}
