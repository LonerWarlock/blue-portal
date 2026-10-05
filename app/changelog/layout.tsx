import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/changelog", "Blue Changelog | Product Release Notes", "Read published release notes and product changes for Blue by Imergene.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
