import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata("/security", "Blue Security | Project Access and Data Practices", "Learn about Blue's project access, local execution and security practices. Review permissions and model-provider policies.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
