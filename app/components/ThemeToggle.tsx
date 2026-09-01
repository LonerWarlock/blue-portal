"use client";

import { useTheme, ThemePreference } from "../contexts/ThemeContext";
import { Moon, Sun, SunMoon, type LucideIcon } from "lucide-react";

const OPTIONS: { value: ThemePreference; icon: LucideIcon; label: string }[] = [
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "system", icon: SunMoon, label: "Match system theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
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
        const Icon = opt.icon;
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
            <Icon aria-hidden="true" className="h-3 w-3" />
          </button>
        );
      })}
    </div>
  );
}
