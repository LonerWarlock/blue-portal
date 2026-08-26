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
        ink: { DEFAULT: "#F5F9FF", muted: "#A9B9CC", faint: "#7C8CA6" },
        paper: { DEFAULT: "#07111F", alt: "#0D1B2A", sunken: "#10243A" },
        line: { DEFAULT: "#24374F", strong: "#3D5878" },
        brand: { DEFAULT: "#5CB8FF", hover: "#7FC6FF" },
        accent: { DEFAULT: "#38D9FF" },
        success: "#37B978",
        danger: "#E2564D",
        warning: "#DCA632",
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
