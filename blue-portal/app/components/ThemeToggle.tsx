"use client";

import { useTheme, ThemePreference } from "../contexts/ThemeContext";

const OPTIONS: { value: ThemePreference; icon: string; label: string }[] = [
  { value: "light", icon: "fa-sun", label: "Light theme" },
  { value: "system", icon: "fa-circle-half-stroke", label: "Match system theme" },
  { value: "dark", icon: "fa-moon", label: "Dark theme" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-line bg-paper-alt"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-label={opt.label}
            aria-pressed={active}
            onClick={() => setTheme(opt.value)}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors duration-150 ${
              active ? "bg-surface text-brand shadow-soft" : "text-ink-faint hover:text-ink-muted"
            }`}
          >
            <i className={`fa-solid ${opt.icon} text-[11px]`} />
          </button>
        );
      })}
    </div>
  );
}
