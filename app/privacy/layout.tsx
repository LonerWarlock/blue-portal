import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/privacy", "Blue Privacy Policy | Data and Account Information", "Read how Imergene handles personal information when you use Blue, its website and related services.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
