"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function LoadingOverlay() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const prevPath = useRef(pathname);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setLoading(false), 250);
      return () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      };
    }
  }, [pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (!link) return;
      if (link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setLoading(true);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [pathname]);

  return <div aria-hidden="true" data-active={loading} className="executive-route-progress" />;
}
