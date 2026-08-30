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
        ink: { DEFAULT: "#172033", muted: "#667085", faint: "#98A2B3" },
        paper: { DEFAULT: "#FAF8F4", alt: "#F3F0E9", sunken: "#EAE6DC" },
        surface: { DEFAULT: "#FFFFFF" },
        line: { DEFAULT: "#E3E6EC", strong: "#CCD2DC" },
        brand: { DEFAULT: "#28648F", hover: "#1F4F72", soft: "#DCECF7" },
        accent: { DEFAULT: "#B7841F" },
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
