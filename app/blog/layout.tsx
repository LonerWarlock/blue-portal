import { createPageMetadata } from '@/lib/seo';

export const metadata = {
  ...createPageMetadata("/blog", "Blue Guides | Published Documentation and Learning Resources", "Read Blue's published coding and AI team guides. Separate blog articles are not currently published on this page."),
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
