import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import LoadingOverlay from "./components/LoadingOverlay";
import FloatingAssistant from "./components/FloatingAssistant";
import MetaPixelPageView from "./components/MetaPixel";
import ConditionalMetaPixel from "./components/ConditionalMetaPixel";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { PostHogProvider } from "./providers/PostHogProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CookieConsentProvider } from "./contexts/CookieConsentContext";
import JsonLd from "./components/JsonLd";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_SCHEMA, SITE_URL } from "@/lib/seo";

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
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

// Legacy, non-critical pages still use Font Awesome class names. Load that
// compatibility stylesheet after hydration so it cannot block first paint.
// The landing page itself uses local Lucide components.
const FONT_AWESOME_INIT_SCRIPT = `
(function () {
  if (document.querySelector('link[data-blue-font-awesome]')) return;
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
  link.crossOrigin = 'anonymous';
  link.dataset.blueFontAwesome = 'true';
  document.head.appendChild(link);
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
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: "%s" },
  description: HOME_DESCRIPTION,
  applicationName: "Blue",
  creator: "IMERGENE",
  publisher: "IMERGENE",
  icons: { icon: "/images/blue-symbol.png", apple: "/images/blue-symbol.png" },
  verification: { google: "PsWJ5-fDX0TuVohHswUfYqo36Xk7CipkY0E68mp6Dwg" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Meta Pixel and PostHog are now loaded conditionally via CookieConsentContext */}
      </head>
      <body className="min-h-screen bg-paper text-ink flex flex-col antialiased relative font-sans">
        <JsonLd data={SITE_SCHEMA} />
        <Script id="blue-deferred-font-awesome" strategy="afterInteractive">
          {FONT_AWESOME_INIT_SCRIPT}
        </Script>
        <CookieConsentProvider>
          <ConditionalMetaPixel />
          <MetaPixelPageView />
          <ThemeProvider>
            <PostHogProvider>
              <AuthProvider>
                <LoadingOverlay />
                {children}
                <FloatingAssistant />
                <CookieConsentBanner />
              </AuthProvider>
            </PostHogProvider>
          </ThemeProvider>
        </CookieConsentProvider>
      </body>
    </html>
  );
}
