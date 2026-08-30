import type { Config } from "tailwindcss";

const themeColor = (token: string) => `rgb(var(--${token}-rgb) / <alpha-value>)`;

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: themeColor("ink"), muted: themeColor("ink-muted"), faint: themeColor("ink-faint") },
        paper: { DEFAULT: themeColor("paper"), alt: themeColor("paper-alt"), sunken: themeColor("paper-sunken") },
        surface: { DEFAULT: themeColor("surface") },
        line: { DEFAULT: themeColor("line"), strong: themeColor("line-strong") },
        brand: { DEFAULT: themeColor("brand"), hover: themeColor("brand-hover"), soft: themeColor("brand-soft") },
        accent: { DEFAULT: themeColor("accent") },
        success: { DEFAULT: themeColor("success") },
        danger: { DEFAULT: themeColor("danger") },
        warning: { DEFAULT: themeColor("warning") },
        terminal: { DEFAULT: themeColor("terminal") },
      },
      boxShadow: {
        soft: "var(--shadow-sm)",
        elevated: "var(--shadow-md)",
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
