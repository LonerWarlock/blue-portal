import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import LoadingOverlay from "./components/LoadingOverlay";
import FloatingAssistant from "./components/FloatingAssistant";
import MetaPixelPageView from "./components/MetaPixel";
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

const META_PIXEL_ID = "1104103875476885";
const META_PIXEL_INIT_SCRIPT = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Script id="meta-pixel" strategy="afterInteractive">
          {META_PIXEL_INIT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-screen bg-paper text-ink flex flex-col antialiased relative font-sans">
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
        <MetaPixelPageView />
        <Script id="blue-deferred-font-awesome" strategy="afterInteractive">
          {FONT_AWESOME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <PostHogProvider>
            <AuthProvider>
              <LoadingOverlay />
              {children}
              <FloatingAssistant />
            </AuthProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
