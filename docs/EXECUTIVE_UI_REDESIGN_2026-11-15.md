# Executive UI redesign — 2026-11-15

## Scope
Shared neutral light/dark tokens, 56px navigation, restrained one-time editorial reveals, reduced-motion support, non-blocking route progress, editorial landing page, video theater, flat pricing matrix and dashboard surfaces. Existing server pricing, payment callbacks, model routing and SQL authority remain unchanged by the redesign.

The landing page uses `public/videos/blue-desktop-website.mp4` (user-supplied 30-second 1920×1080 video). Teams uses `public/videos/blue-teams-promo.mp4`. Both include locally decoded JPEG posters, muted inline playback and play/sound controls. No external video service is required.

Personal and Organization consoles share an accessible styled workspace menu, with keyboard navigation, Escape/outside dismissal, selected state and a New Organization action. Pricing passes currency and quantity to the existing checkout/onboarding paths. Checkout calculations remain server-validated.

Teams primary CTAs now use `--on-brand` instead of hard-coded white. Browser verification: dark foreground #0a0a0a on #ededed in dark mode; white foreground on #0a0a0a in light mode.

## Verification
- Production build and TypeScript no-emit check passed.
- 72 selected billing, payment, account-cache, testimonial and dashboard tests passed.
- 43 public rendering, auth lazy loading, SEO and Desktop-release tests passed.
- Updated the obsolete Teams pricing test to require ₹115 per credit, ₹2,875 for 25 credits, and US$1 of actual model usage per Blue Credit; it also rejects the retired 30% fee wording.
- Final combined push-readiness run: all 255 Teams, subscription, credit checkout, public-rendering and Organization dashboard UX checks passed (0 failures).
- Browser confirmed landing video metadata and decoding, both CTA themes, Download page and pricing controls.
- Organization/personal screenshots use isolated sample data rendered through the actual components. The local server has no Supabase auth credentials, so no live authenticated checkout/payment was attempted.
- Browser viewport override did not resize the in-app tab; mobile styling exists but mobile browser verification remains unconfirmed.
- Temporary poster helper removed. Obsolete development cache preserved outside the repository in the Windows temporary directory.

## Handoff
Push/deploy remains with the user. No additional migration or environment variable is required for this visual redesign. Include new untracked components, CSS files, posters and MP4 assets. Earlier Organization ledger/API work remains in the working tree and is not removed by this change.
