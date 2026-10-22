const assert = require('node:assert/strict');
const test = require('node:test');
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match');
const { matchHas, prepareDestination } = require('next/dist/shared/lib/router/utils/prepare-destination');
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants');
const createConfig = require('../next.config.js');
const {
  CANONICAL_SITE_ORIGIN,
  LEGACY_SITE_HOST,
  PUBLIC_MARKETING_PATHS,
  publicMarketingRedirects,
} = require('./seoRedirects.cjs');

// Exercise the installed Next 14 matchers, not an approximation of host/path
// matching, so dots, nested paths and unexpected hosts cannot widen the rule.
function matchedRedirect(pathname, host = LEGACY_SITE_HOST, query = {}) {
  for (const rule of publicMarketingRedirects()) {
    const pathParams = getPathMatch(rule.source)(pathname);
    if (!pathParams) continue;
    const hasParams = matchHas({ headers: { host } }, query, rule.has, rule.missing);
    if (hasParams === false) continue;
    const { parsedDestination } = prepareDestination({
      destination: rule.destination,
      params: { ...pathParams, ...hasParams },
      query,
      appendParamsToQuery: false,
    });
    return { rule, parsedDestination };
  }
  return null;
}

test('reviewed public content uses same-path permanent canonical redirects', async () => {
  assert.equal(new Set(PUBLIC_MARKETING_PATHS).size, PUBLIC_MARKETING_PATHS.length);
  assert.deepEqual(await createConfig(PHASE_PRODUCTION_BUILD).redirects(), publicMarketingRedirects());
  for (const path of PUBLIC_MARKETING_PATHS) {
    const result = matchedRedirect(path);
    assert.ok(result, `Missing redirect for ${path}`);
    assert.equal(result.rule.destination, `${CANONICAL_SITE_ORIGIN}${path}`);
    assert.equal(result.rule.permanent, true);
    assert.equal(result.parsedDestination.pathname, path);
    assert.equal(result.parsedDestination.protocol, 'https:');
    assert.equal(result.parsedDestination.hostname, 'blue.imergene.in');
    assert.ok(!/[:*()]/.test(result.rule.source), 'No wildcard or dynamic source');
  }
});

test('host match is limited to the exact legacy hostname', () => {
  for (const host of [
    'blue.imergene.in', 'localhost:3005', 'blue-portal-preview.vercel.app',
    'blue-by-imergeneXvercelYapp', 'blue-by-imergene.vercel.app.evil.invalid',
    'www.blue-by-imergene.vercel.app', 'evil-blue-by-imergene.vercel.app',
  ]) {
    for (const path of PUBLIC_MARKETING_PATHS) assert.equal(matchedRedirect(path, host), null, `${host}${path}`);
  }
  assert.ok(matchedRedirect('/teams', LEGACY_SITE_HOST.toUpperCase()));
});

test('account, checkout, API callbacks, service and unknown routes remain untouched', () => {
  for (const path of [
    '/console', '/console/settings', '/auth', '/auth/callback', '/login', '/callback',
    '/checkout', '/checkout/blue', '/checkout/teams', '/blue-pro',
    '/blue-pro/checkout', '/blue-pro/dashboard', '/subscribe',
    '/api', '/api/auth/send-otp', '/api/auth/verify-otp', '/api/user/subscription',
    '/api/checkout/payu/callback', '/api/checkout/paypal/capture',
    '/api/teams/checkout/payu/callback', '/api/teams/checkout/paypal/capture',
    '/api/blue-pro/payu/callback', '/api/blue-pro/paypal/capture',
    '/api/runtime/v1/tasks', '/api/desktop/store-release',
    '/courses', '/courses/java', '/internships', '/hackathon', '/services',
    '/_next/static/app.js', '/teams/unknown', '/docs/unknown', '/unknown',
  ]) assert.equal(matchedRedirect(path), null, path);
});

test('existing query parameters survive without introducing host parameters', () => {
  const query = { utm_source: 'newsletter', ref: 'public-demo', tag: ['desktop', 'teams'] };
  const result = matchedRedirect('/teams', LEGACY_SITE_HOST, query);
  assert.deepEqual(result.parsedDestination.query, query);
  assert.equal(result.rule.destination, 'https://blue.imergene.in/teams');
});

test('existing build selection and security/robots headers are preserved', async () => {
  assert.equal(createConfig(PHASE_DEVELOPMENT_SERVER).distDir, '.next-dev');
  const config = createConfig(PHASE_PRODUCTION_BUILD);
  assert.equal(config.distDir, '.next');
  assert.equal(config.poweredByHeader, false);
  assert.deepEqual(await config.headers(), [{
    source: '/:path*',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
    ],
  }, ...['/api/:path*', '/console/:path*', '/checkout/:path*', '/blue-pro/checkout/:path*', '/blue-pro/dashboard/:path*'].map(source => ({
    source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
  }))]);
});
