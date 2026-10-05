import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/blog", "Blue Blog | AI Coding and Product News", "Explore articles and product news from the Blue by Imergene team.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
