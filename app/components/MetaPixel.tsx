"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function MetaPixelPageView() {
  const pathname = usePathname();
  const initialPageView = useRef(true);

  useEffect(() => {
    if (initialPageView.current) {
      initialPageView.current = false;
      return;
    }

    window.fbq?.("track", "PageView");
  }, [pathname]);

  return null;
}
