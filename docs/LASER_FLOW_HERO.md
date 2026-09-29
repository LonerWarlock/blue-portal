# Homepage Laser Flow visual

Local-only implementation requested on 2026-09-29. Do not deploy automatically.

- One full-width blue/navy visual below the existing hero copy in `app/components/Hero.tsx`, with no outer rounded parent box; existing headline, links, and installation snippet stay intact.
- Official React Bits JavaScript/CSS Laser Flow from the user's supplied prompt, with `falloffStart={0.5}` applied to LaserFlow (not the image), vendored with its full license and upstream reference. See `app/components/react-bits/README.md`.
- Above the beam's landing point, a cursor-following spotlight reveals “Blue Desktop. Launching soon”. A blue separator line marks where the beam lands. The actual Desktop 0.1.17 screenshot is a sibling below the beam area, always visible rather than hidden behind a hover mask. It includes the real menus, icons, composer and buttons, with an empty offline preview account and no private user data. No third-party stock asset requests.
- Requested stronger beam settings: fog intensity 0.38, wisp intensity 4, wisp density 1.2, horizontal sizing 1.05. These change only this homepage visual.
- The renderer is client-only and loaded only when this homepage visual enters the viewport and WebGL is available. Lower mobile resolution, adaptive upstream resolution, hidden-tab pause, and explicit renderer unmount outside the viewport prevent wasted GPU drawing. Re-entry uses the already cached module. A keyboard-accessible pause button stays available while the beam is visible.
- Reduced-motion and data-saving users see a static preview. Touch/non-hover users see the launch text without needing to hover. Renderer/shader/context failures keep the page usable with a static fallback. The 44px pause/play control is keyboard accessible, stays clear of the sticky header, and is bounded to the beam area rather than floating over the rest of the page.
- No changes to billing, models, credits, MCP connections, Blue Desktop, checkout, or account pages.

## Local verification

1. `npm ci`
2. `npm run dev -- --hostname 127.0.0.1` (default port 3005)
3. In another terminal, set `BLUE_HERO_PREVIEW_URL=http://127.0.0.1:3005` and run `npm run test:hero`.
4. The browser smoke test needs an installed Playwright Chromium. If using another installed Chromium build, set `BLUE_HERO_CHROMIUM_EXECUTABLE` to its executable. It starts a fresh headless browser, not a personal browser profile. All remote traffic, backend routes, and writes are blocked/stubbed during tests.
5. Screenshots go to a new temporary directory, printed after the checks. `BLUE_HERO_ARTIFACT_DIR` can point to another test-output directory.
6. Run `npx tsc --noEmit --incremental false` and `npm run build`.

The browser checks cover real WebGL drawing, removal of the outer box, separator/preview alignment, desktop/mobile overflow, launch-copy pointer reveal/reset, mobile static-copy visibility, accessible pause/keyboard resume, offscreen drawing pause, context-loss fallback, reduced-motion changes, missing WebGL, preserved CTA links, and exclusion from checkout. They never sign in, charge credits, call a model, or deploy.

## Refreshing the Desktop image

Build the latest Desktop frontend in the BlueV2 checkout with `npm run build` from `desktop`, then serve it with Vite preview on loopback port 4179. Run `node scripts/capture-blue-desktop-preview.cjs` from this Portal checkout (with the same Chromium executable setting). The script captures the actual application renderer, asserts the current control labels, blocks external traffic and execution, and replaces `public/images/blue-desktop-preview.png`. No Desktop source edits or interruption of the running packaged app are needed. Update the preview fixture version when Desktop advances.

## Verified locally (2026-09-29)

- Desktop 0.1.17 frontend build and current-control capture assertions passed.
- Portal type check, production build (61 generated routes), and all 14 hero UX browser checks passed, including the final stronger fog/wisp settings, full-width layout, launch-message hover, touch fallback, dark theme and offscreen renderer cleanup.
- Account suite: 20 passed. Existing billing/security suite: 37 passed, one unchanged analytics assertion failed (`lib/scalingSecurity.test.mjs`, global Meta Pixel expectation). The existing consent-gated tracking layout and that test were not changed by this work.
- No deployment, commit, push, Desktop restart, account sign-in, model call, or credit charge was performed.
