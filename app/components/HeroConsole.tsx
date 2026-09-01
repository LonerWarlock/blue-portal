"use client";

import { Zap } from "lucide-react";
import LazyVideo from "./LazyVideo";

// The actual Blue Console product demo — same file used elsewhere on the
// site (public/videos/portfolio_demo.mp4). Only the surrounding container,
// spacing, and chrome are styled here; playback behavior (autoplay, muted,
// loop, controls) is preserved as-is.
export default function HeroConsole() {
  return (
    <div className="panel overflow-hidden shadow-md">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-line bg-paper-alt">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-line-strong" />
          <div className="w-2.5 h-2.5 rounded-full bg-line-strong" />
          <div className="w-2.5 h-2.5 rounded-full bg-line-strong" />
        </div>
        <span className="text-xs text-ink-faint ml-3 font-mono">blue-console</span>
        <div className="ml-auto text-ink-faint">
          <Zap aria-hidden="true" className="h-3 w-3" />
        </div>
      </div>
      <div className="relative bg-terminal aspect-video">
        <LazyVideo
          src="/videos/portfolio_demo.mp4"
          label="Blue console product demonstration"
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
