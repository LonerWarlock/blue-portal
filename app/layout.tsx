import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import LoadingOverlay from "./components/LoadingOverlay";
import { PostHogProvider } from "./providers/PostHogProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

// Resolves and applies the theme before first paint, so there is no
// flash of the wrong theme on load. Reads the same localStorage key
// that ThemeContext writes to.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem('blue-ai-theme') || 'system';
    var resolved = pref === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : pref;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {}
})();
`;

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Blue AI — Let AI code for you while you think",
  description: "Blue's Autonomous Agents build entire features, run tests, and fix bugs by themselves. Accelerate development by handing off tasks to Blue while you focus on architecture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-paper text-ink flex flex-col antialiased relative font-sans">
        <ThemeProvider>
          <PostHogProvider>
            <AuthProvider>
              <LoadingOverlay />
              {children}
            </AuthProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
