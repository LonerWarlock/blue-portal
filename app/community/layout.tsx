import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = {
  ...createPageMetadata('/community', 'Blue Community | Imergene Sessions, Hackathons & Winners', 'Meet the Blue community by Imergene. Explore our PVPIT, Budhgaon session, the first Imergene hackathon, HackHers in the winners circle and upcoming community events.'),
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
