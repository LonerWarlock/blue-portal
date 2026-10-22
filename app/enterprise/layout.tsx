import { createPageMetadata } from '@/lib/seo';

// Enterprise capability claims need review before becoming search landing pages.
export const metadata = {
  ...createPageMetadata("/enterprise", "Blue for Teams | Enterprise Enquiries", "Explore Blue for team workflows and contact Imergene about enterprise requirements."),
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
