import type { Metadata } from 'next';

// Verified public production origin. Never use localhost or a preview host as
// the canonical origin, including when this module runs in a local build.
export const SITE_URL = 'https://blue.imergene.in';
export const SITE_NAME = 'Blue by Imergene';
export const HOME_TITLE = 'Blue by Imergene | AI Coding Assistant & Agent Teams';
export const HOME_DESCRIPTION = 'Code, research and coordinate AI agent teams in Blue Desktop for Windows. Also available as a VS Code coding assistant. App subscription access and AI model usage are separate.';
export const STUDENT_GUIDE_PATH = '/guides/ai-coding-assistant-for-students';
export const TEAM_GUIDE_PATH = '/guides/ai-agent-teams';

export const INDEXABLE_PATHS = [
  '/', '/pricing', '/teams', '/docs', '/product/agents', STUDENT_GUIDE_PATH, TEAM_GUIDE_PATH,
  '/about', '/contact', '/privacy', '/terms', '/refund',
] as const;

export function canonicalUrl(path = '/'): string {
  // Keep this helper restricted to our own absolute paths.
  if (!path.startsWith('/') || path.startsWith('//') || /[?#\\\u0000-\u0020\u007f]/.test(path)) {
    throw new Error('Canonical URLs require a query-free local path');
  }
  return new URL(path, SITE_URL).toString();
}

export function createPageMetadata(path: string, title: string, description: string): Metadata {
  const url = canonicalUrl(path);
  const image = { url: canonicalUrl('/opengraph-image'), width: 1200, height: 630, alt: 'Blue by Imergene — AI coding assistant and agent teams for Windows' };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', locale: 'en_US', siteName: SITE_NAME, title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export function privatePageMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
}

export const SITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'IMERGENE', alternateName: 'Imergene', description: 'Imergene develops and operates Blue Desktop for Windows, with AI coding, project teams and browser workflows, and the Blue Coding Assistant VS Code extension.', url: SITE_URL, logo: canonicalUrl('/images/blue-symbol.png') },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: SITE_NAME, alternateName: ['Blue', 'Blue Desktop', 'blue.imergene.in'], description: HOME_DESCRIPTION, url: SITE_URL, inLanguage: 'en', publisher: { '@id': `${SITE_URL}/#organization` }, about: { '@id': `${SITE_URL}/#blue-desktop` } },
  ],
};

export const DESKTOP_APP_SCHEMA = {
  '@context': 'https://schema.org', '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#blue-desktop`, name: 'Blue Desktop',
  url: SITE_URL, applicationCategory: 'DeveloperApplication', operatingSystem: 'Windows',
  description: HOME_DESCRIPTION,
  publisher: { '@id': `${SITE_URL}/#organization` },
  creator: { '@id': `${SITE_URL}/#organization` },
  downloadUrl: 'https://apps.microsoft.com/detail/9NHV6GFJ64C8',
  featureList: ['Explain project code', 'Plan and edit project files', 'Run relevant development checks', 'Choose supported AI models', 'Coordinate specialist agents in Desktop Team mode with active Teams credit access and Blue Models', 'Research and browser work with permissions and user sign-in', 'Run independent project tasks in parallel while Blue and the computer stay on'],
};
