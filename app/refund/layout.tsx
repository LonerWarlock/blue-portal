import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/refund", "Blue Refund and Cancellation Policy", "Read Blue's refund and cancellation policy before purchasing subscriptions, credits or other digital services.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
