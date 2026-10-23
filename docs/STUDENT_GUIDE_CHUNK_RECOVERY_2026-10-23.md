# Student-guide required JavaScript recovery and Store release feed

## Evidence and diagnosis

Google URL Inspection's live test at 16:25:03 IST on 2026-10-23 fetched the
student guide with HTTP 200, crawl allowed, and indexing allowed. Its final DOM
contained the global "Something went wrong" screen, not the article or its
canonical. Console diagnostics identified `ChunkLoadError: Loading chunk 3185
failed`, followed by React hydration error 423. The resource panel identified
`/_next/static/chunks/app/layout-0d43166f49223f3f.js` as its only failed resource
(one of 18), with reason "Other error".

The full guide and canonical were present in the original HTML/RSC payload.
The exact asset subsequently returned 200, JavaScript, 16,191 bytes. This was
not an absent article, a robots exclusion, or proof of a permanently missing
asset. Google does not expose a more specific transport reason here. We do
not claim to have established a Vercel outage, firewall block, deployment skew,
or the reason Google's individual fetch failed.

The reproducible application defect is the failure handling: losing the
shared root-layout chunk rejects the root client providers and replaces valid
server-rendered content with the global error boundary. There is also a race
when a parser-inserted async script fails before Webpack installs its event
handler: the loader finds the already-failed script and waits for an event
which already happened. The installed Next 14.2.35 browser runtime reuses
matching script tags and has a 120-second timeout. The unmodified local build
reproduced the same chunk 3185 error/React 423/global fallback; a single failed
initial request also reproduced the timeout without another request.

## Targeted fix

- A small synchronous head listener removes failed same-origin Next chunk
  script elements, without stopping error propagation. A later loader call
  can make a real request rather than attaching to the failed initial tag.
- A production-client-only Webpack runtime extension retries script transport
  error/timeout at most twice, after 150 ms and 300 ms. Retry requests retain
  the exact origin/path and existing query parameters, with a bounded cache
  retry parameter. RSC chunk filename mapping and Webpack's original loader,
  nonce handling, success/error callbacks, and application execution stay in
  place. No hard reloads, user-agent branches, hidden replacement content,
  permission changes or new dependencies are added.
- Transport success is not application success. Missing chunk registration
  and genuine JS errors are still handled by the framework; persistent fetch
  failures exhaust the retry budget and show the honest error boundary.

## Local verification

`scripts/serve-chunk-failure.cjs` binds only to loopback and forwards only to
the fixed local Next server. It strips cookies/authentication headers, never
proxies arbitrary hosts, and is not imported by production. It selects the
actual built layout asset from the build manifest rather than hardcoding the
old hash or blocking an optional analytics dependency.

Real browser checks against the production build:

| Injected failure | Observed outcome |
| --- | --- |
| Unmodified build, required layout unavailable | Same chunk 3185 error and global error screen |
| Fixed build, first request fails | Two requests total; article renders and theme control responds |
| Fixed build, first two requests fail | Three requests total; article and canonical retained, theme control responds, no JS console errors |
| Fixed build, all requests fail | Three requests total, no unbounded retries; honest global error screen |

Eight targeted recovery tests cover bounds, timeout recovery, preserved RSC
mapping/loader arguments/query parameters, unrelated paths/origins, cleanup
scope, and client-only production wiring. They are included in
`npm run test:public-rendering` along with existing SEO/auth/analytics checks
and the release-feed tests. Production build/type checking also passed.

## Store release feed

The update button was already implemented. The public feed still listed only
0.1.28.0, so a newer installed copy correctly found no newer advertised release.
Partner Center independently showed Submission 11 live, with current package
`Blue-Desktop-Store-0.1.31-x64.appx`, version `0.1.31.0`; the user also confirmed
certification and publication. The catalog now includes that version and
retains 0.1.28.0. Partner Center showed the publication date, not a precise
instant: the catalog records 2026-10-23T12:07:31.000Z as a conservative time at
which publication had been independently verified, not an invented exact
Store publication instant.

Using the actual Desktop `StoreReleaseService` and the new catalog with fresh
in-memory stores: 0.1.28, 0.1.29 and 0.1.30 report `available` for 0.1.31.0;
0.1.31 and 0.1.32 report `current`; a non-Store build stays `disabled`. The 28
Desktop release-service/button/UI regressions passed. No user profile, real
task, Store installation or account was changed by these checks.

The fixed endpoint remains
`https://blue-by-imergene.vercel.app/api/desktop/store-release`; the legacy API
is not redirected. Existing clients cache release metadata for up to four
hours; **Check for updates** requests an earlier refresh. The notice does not
install anything and does not promise immediate regional Store availability.

## Verification boundaries

Local forced-failure recovery and ordinary production HTTP/browser checks do
not by themselves prove a fresh Google render, indexing, or ranking. Record
the deployed commit, live endpoint and a fresh Google live test separately.
Do not bypass the daily indexing-request quota by changing properties/accounts.
