import type { Metadata } from 'next';

// Verified public production origin. Never use localhost or a preview host as
// the canonical origin, including when this module runs in a local build.
export const SITE_URL = 'https://blue-by-imergene.vercel.app';
export const HOME_TITLE = 'Blue | AI Coding Assistant for Students';
export const HOME_DESCRIPTION = 'Blue is an AI coding assistant made for students. Understand code, build projects and debug with Blue Desktop for Windows or the VS Code extension.';
export const STUDENT_GUIDE_PATH = '/guides/ai-coding-assistant-for-students';

export const INDEXABLE_PATHS = [
  '/', '/pricing', '/docs', '/product/agents', STUDENT_GUIDE_PATH,
  '/contact', '/privacy', '/terms', '/refund',
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
  const image = { url: canonicalUrl('/opengraph-image'), width: 1200, height: 630, alt: 'Blue — AI coding assistant made specifically for students' };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', locale: 'en_US', siteName: 'Blue by Imergene', title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export function privatePageMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
}

export const SITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'IMERGENE', url: SITE_URL, logo: canonicalUrl('/images/blue-symbol.png') },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Blue', alternateName: 'Blue by Imergene', url: SITE_URL, inLanguage: 'en', publisher: { '@id': `${SITE_URL}/#organization` } },
  ],
};

export const DESKTOP_APP_SCHEMA = {
  '@context': 'https://schema.org', '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#blue-desktop`, name: 'Blue Desktop',
  url: SITE_URL, applicationCategory: 'DeveloperApplication', operatingSystem: 'Windows',
  description: HOME_DESCRIPTION,
  publisher: { '@id': `${SITE_URL}/#organization` },
  downloadUrl: 'https://apps.microsoft.com/detail/9NHV6GFJ64C8',
  featureList: ['Explain project code', 'Plan and edit project files', 'Run relevant development checks', 'Choose supported AI models'],
};
