import Navbar from "@/app/components/Navbar";
import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata("Blue Checkout");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="executive-checkout-shell"><Navbar/>{children}</div>;
}
