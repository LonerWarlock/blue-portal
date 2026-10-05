import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/enterprise", "Blue for Teams | Enterprise Enquiries", "Explore Blue for team workflows and contact Imergene about enterprise requirements.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
