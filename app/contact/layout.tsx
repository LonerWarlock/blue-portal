import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/contact", "Contact Blue | AI Coding Assistant Support", "Contact the Blue by Imergene team for help with Blue Desktop, the VS Code extension, plans or product questions.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
