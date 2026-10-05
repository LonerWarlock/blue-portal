import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata("Blue Account");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
