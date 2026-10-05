import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/hackathon", "Imergene Hackathon | Build and Collaborate", "Explore Imergene hackathon information, participation and registration.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
