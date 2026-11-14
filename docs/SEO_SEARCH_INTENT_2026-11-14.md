# Search-intent SEO update — local review

Prepared for local review only. No push or deployment, database migration, new environment variables, provider API changes or payment-amount changes are included.

## Review URLs

The default local command is `npm run dev`, which uses port 3005. A production build can be served with `npm run start -- -H 127.0.0.1 -p 3005`.

- `/`: clearer coding-app metadata, visible setup/pricing/docs links and comparison links.
- `/download`: Windows installation, sign-in, model setup and first task.
- `/hi/download`: equivalent Hindi download instructions, with reciprocal language alternates.
- `/compare/emergent`: text-only workflow and published-price comparison.
- `/compare/codex`: coding, dedicated Team workspace and published-price comparison. Accurately acknowledges Codex subagents.
- `/pricing`: clearer search title, H1 and distinction between app access and model usage. Existing checkout behavior and all prices remain unchanged.
- `/docs`: explicit Blue docs heading and installation links.
- `/desktop`: installation-guide links.
- `/sitemap.xml`: includes the four new public pages with production canonicals.

## Search signals used

The reported queries included Blue coding app, Blue coder, Blue pricing, Blue docs, Imergene and a Hindi download question. These are small-volume signals, not market-size estimates. Existing useful pages were improved rather than duplicating them for individual spelling variants.

## Comparison scope

Codex and Emergent comparisons use official sources, linked on the pages, checked on 14 November 2026. No competitor screenshots, logos, performance rankings, speed tests, invented cost-per-task results, or engine-origin claims are published. No OpenCode comparison page was created. Supported account sign-in documentation remains factual.

Blue subscription and credit prices are imported from the same catalogue used by checkout. Competitor plan prices are dated editorial data and must be rechecked before updating the comparison. Emergent annual-billing prices are labelled as such. Credits and usage allowances are not treated as equivalent units.

New pages are server-rendered/static, with self-canonical metadata and visible navigation links. The legacy-host redirect allowlist covers the new public paths without broadening API/account/checkout redirects. New pages do not add Redis or provider calls.

## Validation

- `npm run build`
- `npm run test:public-rendering`
- With the local server running, set BLUE_SEO_TEST_URL=http://127.0.0.1:3005 for the test process, then run `node --test tests/seo-search-intent-http.test.cjs`. Without that explicit test URL, the HTTP checks skip so ordinary offline test runs do not need a server.

Browser automation may be unavailable in the current Codex session. The HTTP checks inspect the actual served HTML, canonical/language tags, headings, prices, links and sitemap; they do not substitute for your visual desktop/mobile review.

After local approval, deploy through the usual Portal push. Search rankings are not guaranteed and will change only after Google crawls and evaluates the deployed content.

## Emergent page positioning revision

The page now leads with Blue's coding-and-Team workspace, per-specialist model choice, local development tools and built-in connectors. A dedicated connector section covers GitHub, Vercel, React Bits, Canva, Creative Claw and custom MCP connections. Teams pricing leads with a usable credit purchase, no separate monthly Teams subscription and credit carry-forward; the app subscription and usage prices stay visible and unchanged.

Emergent's official connector documentation (https://help.emergent.sh/mcps-connectors), checked on 14 November 2026, confirms it also supports MCP connectors. The comparison acknowledges that support instead of claiming connectors are exclusive to Blue. No performance claims or backend changes were added.
