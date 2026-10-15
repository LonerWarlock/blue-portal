import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/privacy", "Blue Privacy Policy | Google Workspace and Personal Data", "How Imergene handles Blue website and desktop data, Google Workspace access, AI-provider processing, local storage, disconnection and deletion.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
