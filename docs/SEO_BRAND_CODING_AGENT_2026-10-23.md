# Blue brand and coding-agent search improvements

## Observed baseline

On 2026-10-23, the `https://blue.imergene.in/` URL-prefix Search Console
property showed the homepage as "URL is on Google" / "Page is indexed".
An indexing request was already recorded; no repeat request was made.

The selected three-month Web performance report showed 2 clicks, 16
impressions, 12.5% CTR and average position 4.6. The chart covered October
10–21, and the report said it was updated three hours earlier. Its four
displayed queries were `imergene`, `"emergent ai"`, `blue pricing` and
`blue docs`. Displayed query rows need not account for every aggregate click
or impression. The very small sample does not establish a competitive
position for "coding agent", or a ranking for every user and region.

The overview showed 3 indexed and 7 not-indexed pages. That aggregate report
can lag page-level changes; it is not evidence that all seven should be
indexed, because account, checkout and unfinished content are deliberately
excluded. Existing canonical and sitemap work is preserved.

## Changes

- Use the established `Blue by Imergene` name consistently in WebSite JSON-LD,
  application metadata and Open Graph, retaining `Blue`, `Blue Desktop` and
  the real domain as alternative site names. Do not create a second WebSite
  entity or invent another brand.
- Improve the existing `/product/agents` title and visible heading. Explain
  coding agents versus completion/chat, and distinguish ordinary coding work
  from Desktop Team mode.
- Add three clearly labelled example prompts, each with a concrete way to
  check the result. These are examples, not fabricated customer results,
  measured benchmarks, testimonials or a guarantee of task success.
- Include installation, model-connection, pricing, local-running and
  permission boundaries, with useful links to the existing docs and guides.
- Add canonical breadcrumbs and descriptive visible links from navigation,
  the footer and a homepage FAQ. Keep the real product demo explicitly
  illustrative. Correct the old implication that all terminal work must be
  sandboxed: authorized Full Access tasks can work directly in a project.
- No payment, entitlement, account, approval, analytics-consent, canonical
  origin or private-page indexing behavior was changed. No new dependencies.

## Intent map

| Search intent | Existing destination |
| --- | --- |
| Blue by Imergene, Blue coding assistant | `/` |
| AI coding agent, Windows coding agent, VS Code coding assistant | `/product/agents` |
| AI agent teams, coordinated project work | `/teams` and `/guides/ai-agent-teams` |
| Student coding assistant and learning workflows | `/guides/ai-coding-assistant-for-students` |
| Blue pricing and model-usage costs | `/pricing` |
| Blue installation and OpenCode/model setup | `/docs` |

These are editorial targeting choices, not statements that the site ranks
for those queries. The pages must remain useful to their actual readers.

## Verification and release

- All 52 public-rendering, lazy-auth, analytics, canonical/robots, redirect
  and SEO tests passed, including new rendered coding-page and brand tests.
- The Next.js 14.2.35 production build and type validation passed, generating
  all 67 static pages. No dependencies were added.
- Local production HTTP checks returned 200 for `/`, `/product/agents`,
  `/sitemap.xml` and `/robots.txt`. New explanatory content and task prompts
  are present in the server response without needing client JavaScript. The
  sitemap retains 12 canonical production URLs, including the agent page;
  robots advertises the canonical sitemap. No localhost URL entered it.
- In-app browser visual inspection confirmed the new three-column examples
  and working public page. The rendered page has one H1, the production
  canonical URL, the expected WebSite name/alternatives, and no horizontal
  overflow at the inspected desktop width. A narrow/mobile viewport was not
  separately tested in this pass.
- These build and preview checks were performed locally before publication.
  The user subsequently requested a push through the normal Vercel workflow.
  A successful local check is not a production or ranking claim: confirm the
  deployed Git revision, production status and public responses separately.

## What code cannot guarantee

"Blue" is an ambiguous word with a common colour meaning and other brands.
No website setting can remove those results or reserve first place for Blue.
Google selects results using relevance and other signals for each search.
The next sustained work is accurate documentation, real first-hand demos and
case studies, relevant editorial links and consistent official brand profiles.
Do not buy links, invent reviews, create doorway pages, hide keyword text or
keep resubmitting the same indexing request. Do not promise first place or a
deadline for ranking. Review impressions, relevant queries and conversions
after published changes have had time to be crawled and evaluated.

Google references checked for this work:

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- https://developers.google.com/search/docs/appearance/ai-features
