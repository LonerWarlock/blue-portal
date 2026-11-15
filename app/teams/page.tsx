import type { Metadata } from 'next';
import TeamsClient from './TeamsClient';
import TeamsPromoVideo from '@/app/components/TeamsPromoVideo';
import { createPageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = createPageMetadata(
  '/teams',
  'Blue AI Agent Teams for Windows | Imergene',
  'Coordinate AI agents for coding, research and browser work in Blue Desktop by Imergene. Choose models, review results and pay for usage with Blue Credits.'
);

export default function TeamsPage() {
  return <TeamsClient showcase={<TeamsPromoVideo src="/videos/blue-teams-promo.mp4" poster="/videos/blue-teams-promo-poster.jpg" label="Blue Teams product demonstration"/>}/>;
}
