# Updating the Blue community page

The community page is `/community`. It uses the site's shared light/dark colour tokens.

## Event albums

`lib/community.ts` is the content source. Add a new `CommunityEvent` to `communityEvents` with a stable ID, title, location, description, cover and photos. Include its cover photo in its `photos` array. Each album automatically gets thumbnail previews, a photo count and a keyboard-accessible modal viewer.

Place web-sized photographs and thumbnails under `public/images/community`. The initial photographs have full-size and `-thumb` WebP variants. `lib/communityPhotos.ts` records their paths and actual image dimensions. Add equivalent records for new photographs, then give each photo a meaningful description in `lib/community.ts`.

Prefer original photos resized to at most 1800px on the long edge and 640px thumbnails. Keep the original files separately. Respect orientation, avoid stretching, and omit embedded location metadata from published copies.

## Winners

Append a new entry to `communityWinners` in `lib/community.ts`. Include the verified winning team name, award, event, photograph, description and corresponding event ID. Add a project name only when confirmed. The page and its structured winner list render the entries automatically.

The first team is **HackHers**, confirmed by the site owner. Its photograph comes from `First_Hackathon/IMG-20260805-WA0076.jpg`. Member identities and project details have not been inferred from the photograph.

## Next events and updates

The December notice and three short updates currently live in `app/community/page.tsx`. Replace them with confirmed event information when it is available. Add actual dates, venues and registration destinations only after confirmation; do not infer an event date from a photo filename.

There are no fake Discord, social, profile-claim or RSVP destinations. Community enquiries currently go to the existing contact page.

## Validation

Run the normal production build and the existing SEO checks:

```sh
npm run build
node --experimental-strip-types --test lib/seo.test.mjs lib/seoRedirects.test.cjs
```

Check the page in light/dark modes and phone/desktop sizes. Open every new album, confirm photograph descriptions and winner details, and verify navigation with arrow keys and Escape.

The page is included in the canonical sitemap and uses indexable metadata. Publishing requires the normal website commit/push/deployment workflow.
