# SEO and AI-search visibility release — 2026-10-23

## Evidence and scope

The canonical website is https://blue.imergene.in. Both its domain and HTTPS
URL-prefix Search Console properties showed the October 12 failed sitemap
submission. The legacy Vercel property showed a successful October 20 read.
The canonical sitemap was live-tested with Google's inspection tool on October
23: Crawl allowed Yes, Page fetch Successful. Public HTTP checks also returned
200 XML, a working robots file and self-canonical public pages. The initial
historical fetch failure cannot be reconstructed from those observations.

A fresh sitemap request was submitted on October 23. Both canonical-domain
property views show that date, but still display Couldn't fetch / zero pages.
Submission is not confirmation that Google has processed or indexed it. Do not
request indexing of the XML file as if it were a content page, or repeatedly
resubmit it in short intervals.

## Implemented

- Keep the fixed canonical origin, valid sitemap XML, crawlable assets and
  existing Search Console verification ownership tags.
- Permanent same-path public-content redirects from the exact legacy Vercel
  hostname. No wildcard redirect: account, API, payment, checkout and callback
  routes deliberately retain their current behavior.
- Accurate homepage, social preview, Organization/SoftwareApplication facts,
  FAQs, About and documentation for coding plus Desktop Team mode. No invented
  ratings, benchmarks, ranking promises or cloud execution claims.
- Add /guides/ai-agent-teams with server-rendered practical workflows, matching
  breadcrumbs, real plan capacities, costs, permissions and local-running
  limitations. Link it from the footer, About and docs and include it in the
  curated 12-URL sitemap.
- Replace fabricated placeholder content on blog, community, changelog and
  status pages with useful truthful information. Noindex unfinished pages and
  unverified services/enterprise pages, keep them outside the sitemap, and
  remove their footer promotion. Services/enterprise offering copy still needs
  business review before reindexing; existing routes remain accessible.
- Preserve all actual prices, entitlement, payment and authentication logic.

## Verification

- 22 focused SEO/Next redirect tests passed.
- Production Next 14 build and TypeScript validation passed.
- Production-server HTTP checks passed for 12 public paths and equivalent
  canonical URLs, valid sitemap response, six noindex pages and real 308
  redirects preserving path/query. Legacy /console remains 200, not redirected.
  Native HTTP was used for Host-header checks because the local fetch harness
  did not preserve the supplied Host header; no application fix was required.
- Guide inspected in the in-app browser; headings, navigation, content and
  download CTA render correctly.

## Ongoing work, not guaranteed rankings

Review Search Console after Google processes the fresh request; if fetch still
fails, inspect exact current error and hosting request evidence rather than
rewriting already-valid XML. Track relevant branded and task-specific query
impressions, clicks, indexed public pages and download/checkout conversion.
Keep documentation aligned with shipped features. Publish genuinely useful
demonstrations and case studies with consent and real evidence; earn relevant
editorial links. Do not buy links, generate doorway pages or invent reviews.
Google's own AI-search guidance requires ordinary SEO foundations, not a
special AI file, and eligibility does not guarantee inclusion or rank.

References:
- https://support.google.com/webmasters/answer/7451001?hl=en
- https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- https://developers.google.com/search/docs/appearance/ai-features

Production deployment and indexing requests must be recorded after they are
actually observed; the local build alone is not a live deployment.
