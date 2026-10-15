# Google OAuth verification: local privacy-copy update

Status: website source prepared for publisher review. **Not deployed, not submitted, not certified.**

The optional Google Workspace notice is at `/privacy#google-workspace`. It describes the current Blue Desktop connector, not a Google login feature or a connection available in every client.

## What this update covers

- Five requested grants: Gmail modify, full Drive, Calendar, Contacts read-only, and Tasks.
- Supported data access and actions, including approval for mutations and Drive move inheritance.
- Google content entering the configured engine/gateway/model provider as request context.
- Encrypted local OAuth credentials versus ordinary local chat state and separate native-engine history.
- Local disconnect versus Google Account revocation, and the limits of deleting local chats.
- Corrections to conflicting blanket security/services copy; preserved existing website/payment/privacy contact information and Search Console tags.

## Still required before publishing/submitting

1. Publisher review of the privacy wording and existing business/legal statements. This is an implementation-based disclosure, not legal certification.
2. A prominent in-app Google-data/AI-provider disclosure and affirmative consent before connecting or transferring data. A website notice alone does not implement this.
3. Review and enforce allowed provider/gateway handling of Google data, including permitted use, training restrictions, retention and any onward provider routing. Current code does not establish a universal no-training or zero-retention guarantee; do not claim one in the consent screen or demo.
4. Re-check minimum scopes. In particular, existing Calendar tools only read calendars/events and respond to invitations; review narrower grants before justifying full `calendar`. Full Drive and Gmail modify are restricted grants, not an exemption obtained by calling the app local.
5. Test the real OAuth flow and each requested function with the designated test account, including partial grants, approvals, disconnect and deletion guidance. Existing mocked tests do not prove live authorization.
6. Publish reviewed website changes only with publisher authorization, and verify the live homepage/privacy/terms links match Google Branding.
7. Complete brand verification, then the applicable sensitive/restricted data-access review. Prepare an English demonstration showing consent, actual features for each scope, and the direction of data sent to model services. Determine and complete any required independent security assessment for restricted data sent through third-party services.

Keep the app in Testing while these issues remain. Do not publish branding or submit data-access verification merely because domain ownership was verified.

## References

- [Google verification requirements](https://support.google.com/cloud/answer/13464321)
- [Restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)

## Local checks

Run `node --test tests/google-workspace-privacy.test.cjs` and `node --experimental-strip-types --test lib/seo.test.mjs`. Run TypeScript validation and the website production build before deploying. These checks validate rendering/copy regressions, not Google approval or provider-policy compliance.

Validation on 15 October 2026: 8 privacy checks and 15 existing SEO checks passed; `tsc --noEmit --incremental false` passed; `git diff --check` passed. The normal `npm run build` stalled at optimized production compilation and was stopped after it ceased making observable progress. A full production build is **not confirmed** and remains required before deployment. No changes were made to fonts, dependencies, Google grants, live DNS, or deployment settings.
