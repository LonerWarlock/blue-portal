import type { Metadata } from 'next';
import TeamsClient from './TeamsClient';
import { createPageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = createPageMetadata(
  '/teams',
  'Blue Teams | AI Agent Teams for Windows Projects',
  'Coordinate specialist AI agents for coding, research and browser tasks in Blue Desktop. Unlock Teams with a purchase of 25 Blue Credits. Pay as you go with Blue Models, shared credits and no separate Teams subscription.'
);

export default function TeamsPage() {
  return <TeamsClient />;
}
