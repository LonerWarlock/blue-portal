import type { Metadata } from 'next';
import TeamsClient from './TeamsClient';
import { createPageMetadata } from '@/lib/seo';
import { getBlueTeamsCheckoutConfig } from '@/lib/blueTeamsCheckoutMode';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = createPageMetadata(
  '/teams',
  'Blue Teams | AI Agent Teams for Windows Projects',
  'Coordinate specialist AI agents for coding, research and browser tasks in Blue Desktop. Compare Teams plans, project limits and local execution requirements.'
);

export default function TeamsPage() {
  return <TeamsClient checkout={getBlueTeamsCheckoutConfig()} />;
}
