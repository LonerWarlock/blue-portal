const CANONICAL_SITE_ORIGIN = 'https://blue.imergene.in';
const LEGACY_SITE_HOST = 'blue-by-imergene.vercel.app';

// Keep this a reviewed list of public content, not a wildcard. The legacy
// host can still receive account, payment and service requests; redirecting
// those across origins could break in-flight sessions or payment callbacks.
const PUBLIC_MARKETING_PATHS = Object.freeze([
  '/',
  '/pricing',
  '/teams',
  '/docs',
  '/product/agents',
  '/guides/ai-coding-assistant-for-students',
  '/guides/ai-agent-teams',
  '/community',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/refund',
  '/sitemap.xml',
  '/robots.txt',
]);

function publicMarketingRedirects() {
  // Next's `has.value` is a regular expression, so escape literal host dots.
  // Next automatically forwards query parameters to the same destination path.
  const exactLegacyHost = LEGACY_SITE_HOST.replace(/\./g, '\\.');
  return PUBLIC_MARKETING_PATHS.map(source => ({
    source,
    has: [{ type: 'host', value: exactLegacyHost }],
    destination: `${CANONICAL_SITE_ORIGIN}${source}`,
    permanent: true,
  }));
}

module.exports = {
  CANONICAL_SITE_ORIGIN,
  LEGACY_SITE_HOST,
  PUBLIC_MARKETING_PATHS,
  publicMarketingRedirects,
};
