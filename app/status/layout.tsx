import { createPageMetadata } from '@/lib/seo';

export const metadata = {
  ...createPageMetadata("/status", "Blue Availability Information | Troubleshooting and Support", "Find troubleshooting and support links for Blue. This page does not provide an automated public live status feed."),
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
