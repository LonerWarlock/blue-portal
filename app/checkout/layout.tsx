import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata("Blue Checkout");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
