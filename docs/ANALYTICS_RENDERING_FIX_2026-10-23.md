# Public-page analytics failure isolation — 2026-10-23

## Observed failure

Google Search Console's smartphone live tests for `/teams` and
`/guides/ai-agent-teams` returned HTTP 200 but rendered the global
"Something went wrong" screen and classified it as a Soft 404. The guide's
existing Google Index record separately reported that it was already indexed.
The live-test logs reported ChunkLoadError followed by React error 423. The
guide's failed chunk was the PostHog SDK; the earlier Teams test also failed
shared layout/marketing chunks. A later Teams live test passed without changes,
so the underlying intermittent resource-fetch problem was not proved resolved.

The root layout previously statically imported the SDK's React provider and
wrapped all auth and page content with it. This made optional analytics a
required dependency of both public pages. HTTP 200, good metadata, substantive
server-rendered content and a valid canonical alone did not prevent a client
chunk failure from replacing the document with an error screen.

## Change

- Replace the analytics ancestor with a lightweight renderless pageview sibling.
- Load the SDK using native dynamic import only for explicitly consented events.
  Unselected/essential consent and a missing analytics key never load it.
- Contain import, initialization, opt-in/out and capture failures. There is no
  React lazy-loading boundary around public content and no polling/reload loop.
- Cancel pending events after consent revocation, disable SDK capture and
  persistence, and require renewed consent before resuming. Do not replay old
  events after renewed consent.
- Preserve the two existing course event names/properties through the safe local
  adapter, removing the remaining eager SDK React import. Payment, authentication,
  plan amounts, entitlements, canonicals and robots rules remain unchanged.

## Local verification

- Production Next 14 build, types and static generation passed.
- 56 focused tests passed: 15 analytics lifecycle/failure/race tests, 22 SEO and
  canonical redirect tests, and 19 existing Teams/payment tests using mocks.
- Both routes return 200 with real server-rendered headings/content, exact
  production canonicals and no noindex directive.
- Build-manifest checks confirm that the 250,475-byte SDK chunk is absent from
  the union of root-layout and route initial chunks for both affected pages.
- Real in-app-browser test against a loopback-only failure fixture:
  zero SDK requests before consent; after consenting, the fixture deliberately
  rejected the SDK with 503. Teams remained intact and its theme control worked.
  Navigation to the guide and a fresh guide reload also remained intact and
  interactive. The fixture recorded three rejected SDK requests.
- No real sign-in, checkout, charge, registration or account mutation was run.

To reproduce the failure-isolation test after building:

```powershell
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3305
node scripts/serve-analytics-failure.cjs --port 3316
```

Visit `http://127.0.0.1:3316/teams`, accept test-site analytics consent, navigate
to the guide and reload it. The local-only fixture status is available at
`/__analytics_test__/status`. It is a development script, not a deployed route
or production proxy.

## Limits and release verification

This removes optional analytics from the critical rendering path and prevents
its failure from taking down the pages. It does not prove why Google's original
resource requests failed, guarantee delivery of every essential application
chunk, resolve the separately reported sitemap-fetch issue, or guarantee Google
indexing/ranking. Record production deployment and fresh Google live-test results
only after observing them; a passing local test is not a live release.
