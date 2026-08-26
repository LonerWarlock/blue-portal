// Small decorative floating AI mascot. Purely visual — no interaction,
// no new functionality — so it never competes with real page content.
// Hidden on very small screens so it can't overlap mobile layouts.
export default function FloatingAssistant() {
  return (
    <div
      aria-hidden="true"
      className="hidden sm:block fixed bottom-5 right-5 md:bottom-7 md:right-7 z-40 pointer-events-none select-none"
    >
      <div className="bot-float w-12 h-12 md:w-14 md:h-14">
        <svg
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_6px_10px_rgba(23,32,51,0.12)]"
        >
          {/* antenna */}
          <line x1="32" y1="8" x2="32" y2="14" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="6" r="2.5" fill="var(--brand)" />

          {/* head */}
          <rect x="12" y="14" width="40" height="32" rx="14" fill="var(--brand)" />
          <rect x="16" y="18" width="32" height="24" rx="10" fill="#ffffff" fillOpacity="0.14" />

          {/* face plate */}
          <rect x="18" y="21" width="28" height="18" rx="8" fill="#ffffff" />

          {/* eyes */}
          <circle cx="27" cy="30" r="3.2" fill="var(--brand)" />
          <circle cx="37" cy="30" r="3.2" fill="var(--brand)" />

          {/* smile */}
          <path d="M27 35 Q32 38 37 35" stroke="var(--brand)" strokeWidth="1.6" strokeLinecap="round" fill="none" />

          {/* ears */}
          <rect x="6" y="26" width="6" height="10" rx="3" fill="var(--brand)" />
          <rect x="52" y="26" width="6" height="10" rx="3" fill="var(--brand)" />

          {/* body hint */}
          <rect x="20" y="48" width="24" height="10" rx="5" fill="var(--brand-soft)" />
        </svg>
      </div>
    </div>
  );
}
