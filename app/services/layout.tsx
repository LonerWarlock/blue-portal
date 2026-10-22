import { createPageMetadata } from '@/lib/seo';

// Keep unverified service-offering copy out of search until it is reviewed.
export const metadata = {
  ...createPageMetadata("/services", "Imergene Services | Software and AI Development", "Explore software development and AI services from Imergene, the team behind Blue."),
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
