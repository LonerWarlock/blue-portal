import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/careers", "Careers at Imergene | Work with the Blue Team", "Explore career opportunities at Imergene, the team behind Blue.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
