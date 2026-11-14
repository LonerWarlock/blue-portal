import Link from 'next/link';
import JsonLd from './JsonLd';
import { EDITORIAL_REVIEW_DATE, editorialSchema } from '@/lib/editorialSeo';
import { canonicalUrl } from '@/lib/seo';

export default function EditorialMeta({ pagePath, headline, showByline = true }: { pagePath: string; headline: string; showByline?: boolean }) {
  return <><JsonLd data={editorialSchema(pagePath, headline)} />{showByline && <p className="mt-4 text-sm leading-7 text-ink-muted">
    By <Link href="/about#identity" className="underline underline-offset-4 hover:text-brand">Imergene</Link>
    {' · Content reviewed '}<time dateTime={EDITORIAL_REVIEW_DATE}>14 November 2026</time>
  </p>}</>;
}

export function EditorialBreadcrumb({ pagePath, label }: { pagePath: string; label: string }) {
  return <><JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
    { '@type': 'ListItem', position: 2, name: label, item: canonicalUrl(pagePath) },
  ] }} /><nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-muted"><Link href="/" className="hover:text-brand">Blue by Imergene</Link>
    <span aria-hidden="true" className="px-2">/</span><span aria-current="page">{label}</span>
  </nav></>;
}
