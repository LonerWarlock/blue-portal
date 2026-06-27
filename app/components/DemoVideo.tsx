"use client";

export default function DemoVideo() {
  return (
    <section id="demo" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            See Blue in action.
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Watch Blue build a complete portfolio website from a single prompt — creating files, writing code, and deploying in seconds.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl glass border border-gray-800/80 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800/80 bg-gray-900/50">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="text-xs text-gray-500 ml-3 font-mono">blue-demo</span>
              <div className="ml-auto text-gray-600">
                <i className="fa-solid fa-video text-xs"></i>
              </div>
            </div>
            <div className="relative bg-black aspect-video">
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
          <p className="text-center text-xs text-gray-500 mt-4">
            Prompt: &ldquo;Build me a complete portfolio website with a hero section, projects grid, and contact form&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}
