"use client";

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
          <i className="fa-solid fa-bolt text-xs" />
        </div>
      </div>
      <div className="relative bg-ink aspect-video">
        <video
          className="w-full h-full object-contain"
          controls
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source src="/videos/portfolio_demo.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}
