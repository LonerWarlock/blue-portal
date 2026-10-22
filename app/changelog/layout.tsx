import { createPageMetadata } from '@/lib/seo';

export const metadata = {
  ...createPageMetadata("/changelog", "Blue Release Information | Desktop and VS Code Listings", "Find the official Blue Desktop and VS Code listings for published releases. A dated release history is not maintained on this page yet."),
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
