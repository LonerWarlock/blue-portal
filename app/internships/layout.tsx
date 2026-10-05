import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/internships", "Imergene Internships | Student Opportunities", "Explore Imergene's internship programmes and information for student applicants.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
