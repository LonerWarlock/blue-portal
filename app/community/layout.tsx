import { createPageMetadata } from '@/lib/seo';

export const metadata = {
  ...createPageMetadata("/community", "Blue Support | Questions and Feedback", "Find Blue support, report a problem or read the documentation. Public community channels are not currently listed here."),
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
