'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCookieConsent } from '../contexts/CookieConsentContext';

let posthogInitialized = false;

function initPostHog() {
  if (posthogInitialized) return;
  if (typeof window === 'undefined') return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (key) {
    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
    });
    posthogInitialized = true;
  }
}

export function PostHogPageView() {
  const pathname = usePathname();
  const { consent } = useCookieConsent();

  useEffect(() => {
    if (consent !== 'all') return;
    if (pathname && typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      if (!posthogInitialized) initPostHog();
      const url = window.origin + pathname;
      posthog.capture('$pageview', {
        $current_url: url,
      });
    }
  }, [pathname, consent]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { consent } = useCookieConsent();
  const wasInitialized = useRef(false);

  useEffect(() => {
    if (consent === 'all' && !wasInitialized.current) {
      initPostHog();
      wasInitialized.current = true;
    }
  }, [consent]);

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
