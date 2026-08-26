import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "var(--ink)", muted: "var(--ink-muted)", faint: "var(--ink-faint)" },
        paper: { DEFAULT: "var(--paper)", alt: "var(--paper-alt)", sunken: "var(--paper-sunken)" },
        surface: { DEFAULT: "var(--surface)" },
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        brand: { DEFAULT: "var(--brand)", hover: "var(--brand-hover)", soft: "var(--brand-soft)" },
        accent: { DEFAULT: "var(--accent)" },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(23,32,51,0.05)",
        elevated: "0 6px 16px rgba(23,32,51,0.06), 0 1px 3px rgba(23,32,51,0.05)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
