import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/community", "Blue Community | Build and Learn Together", "Discover the Blue community and connect with people building and learning with AI coding tools.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
