import { canonicalUrl, SITE_URL } from './seo';

// Actual editorial review date, not a generated freshness timestamp.
export const EDITORIAL_REVIEW_DATE = '2026-11-14';
export function editorialSchema(pagePath: string, headline: string) {
  const url = canonicalUrl(pagePath);
  return { '@context': 'https://schema.org', '@type': 'Article', '@id': url + '#article',
    headline, url, mainEntityOfPage: url, dateModified: EDITORIAL_REVIEW_DATE,
    author: { '@id': SITE_URL + '/#organization' }, publisher: { '@id': SITE_URL + '/#organization' },
    image: canonicalUrl('/opengraph-image'), inLanguage: 'en' };
}
