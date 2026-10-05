import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/terms", "Blue Terms of Use | Imergene", "Read the terms of use for Blue accounts, software and services provided by Imergene.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
