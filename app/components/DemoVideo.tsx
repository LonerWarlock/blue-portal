"use client";

export default function DemoVideo() {
  return (
    <section id="demo" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="eyebrow">// demo</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold tracking-tight text-ink">
            See Blue in action.
          </h2>
          <p className="mt-4 text-ink-muted max-w-2xl mx-auto">
            Watch Blue build a complete portfolio website from a single prompt — creating files, writing code, and deploying in seconds.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="panel overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-line bg-paper-alt">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-line-strong"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-line-strong"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-line-strong"></div>
              </div>
              <span className="text-xs text-ink-faint ml-3 font-mono">blue-demo</span>
              <div className="ml-auto text-ink-faint">
                <i className="fa-solid fa-video text-xs"></i>
              </div>
            </div>
            <div className="relative bg-terminal aspect-video">
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
          <p className="text-center text-xs text-ink-faint mt-4">
            Prompt: &ldquo;Build me a complete portfolio website with a hero section, projects grid, and contact form&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}
