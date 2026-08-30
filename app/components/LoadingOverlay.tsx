"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-terminal/60"
        >
          <motion.div
            className="font-mono font-medium text-lg tracking-tight bg-paper border border-line rounded-md px-4 py-2 text-ink"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="text-ink-muted">{`{ `}</span>
            <span className="text-brand">loading</span>
            <span className="text-ink-muted">{` }`}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
