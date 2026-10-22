import type { Metadata } from 'next';
import TeamsClient from './TeamsClient';
import { createPageMetadata } from '@/lib/seo';
import { getBlueTeamsCheckoutConfig } from '@/lib/blueTeamsCheckoutMode';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = createPageMetadata(
  '/teams',
  'Blue Teams | Your AI team, working together',
  'Choose a Blue Teams plan for coordinated AI agents, organized project work and clear team limits.'
);

export default function TeamsPage() {
  return <TeamsClient checkout={getBlueTeamsCheckoutConfig()} />;
}
