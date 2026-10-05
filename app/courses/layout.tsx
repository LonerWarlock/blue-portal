import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/courses", "Imergene Courses | Learn Programming and Build Projects", "Explore Imergene's programming courses and project-based learning options.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
