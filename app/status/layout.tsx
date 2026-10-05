import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/status", "Blue Service Status | Availability Information", "View service availability information for Blue by Imergene.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
