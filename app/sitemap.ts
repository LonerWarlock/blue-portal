import type { MetadataRoute } from 'next';
import { canonicalUrl, INDEXABLE_PATHS } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  // Curated canonical content only: no account, checkout, API, redirect or
  // placeholder pages, and no fabricated daily last-modified dates.
  return INDEXABLE_PATHS.map(path => ({ url: canonicalUrl(path) }));
}
