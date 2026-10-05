import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/services", "Imergene Services | Software and AI Development", "Explore software development and AI services from Imergene, the team behind Blue.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
