"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCookieConsent } from "../contexts/CookieConsentContext";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function MetaPixelPageView() {
  const pathname = usePathname();
  const { consent } = useCookieConsent();
  const initialPageView = useRef(true);

  useEffect(() => {
    if (consent !== 'all') return;
    if (initialPageView.current) {
      initialPageView.current = false;
      return;
    }

    window.fbq?.("track", "PageView");
  }, [pathname, consent]);

  return null;
}
