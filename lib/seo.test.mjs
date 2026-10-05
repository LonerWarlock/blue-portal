import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as seo from './seo.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const readSource = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const privatePaths = ['/console', '/checkout/blue', '/blue-pro/checkout', '/blue-pro/dashboard'];

// Run only the small SEO modules in isolation: no Next server, rendering,
// browser, network, account data, environment variables or payment calls.
function loadModule(path, imports = {}) {
  const transformed = ts.transpileModule(readSource(path), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.equal(transformed.diagnostics.length, 0);
  const module = { exports: {} };
  vm.runInNewContext(transformed.outputText, {
    module, exports: module.exports,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected SEO module import: ${name}`);
      return imports[name];
    },
  }, { filename: path, timeout: 1000 });
  return module.exports;
}

// Evaluate only each route's exported metadata expression, rather than
// importing unrelated page renderers, authentication or animation code.
function routeMetadata(path) {
  const source = readSource(path);
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)
      || !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'metadata') initializer = declaration.initializer;
    }
  }
  assert.ok(initializer, `${path} must export metadata`);
  return vm.runInNewContext(`(${initializer.getText(file)})`, { ...seo, URL }, { filename: path, timeout: 1000 });
}

test('canonical origin is the fixed HTTPS production site, even in local execution', () => {
  assert.equal(seo.SITE_URL, 'https://blue-by-imergene.vercel.app');
  assert.equal(seo.canonicalUrl(), `${seo.SITE_URL}/`);
  for (const path of seo.INDEXABLE_PATHS) {
    const url = new URL(seo.canonicalUrl(path));
    assert.equal(url.origin, seo.SITE_URL);
    assert.equal(url.pathname, path);
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.doesNotMatch(url.href, /localhost|127\.0\.0\.1|0\.0\.0\.0/);
  }
});

test('canonical helper rejects offsite, protocol-relative, query, fragment and unsafe control paths', () => {
  for (const path of [
    'https://evil.invalid/', 'http://localhost:3005/', 'pricing', '//evil.invalid/',
    '/pricing?plan=yearly', '/pricing#plans', '/\\evil.invalid/',
    '/\n/evil.invalid/', '/\t/evil.invalid/', '/\r/evil.invalid/',
  ]) assert.throws(() => seo.canonicalUrl(path), undefined, `Unsafe canonical path: ${JSON.stringify(path)}`);
});

test('page metadata keeps self-canonical, Open Graph and Twitter facts consistent', () => {
  for (const path of seo.INDEXABLE_PATHS) {
    const title = `Page ${path}`, description = `Description for ${path}`;
    const metadata = seo.createPageMetadata(path, title, description);
    assert.equal(metadata.title, title);
    assert.equal(metadata.description, description);
    assert.equal(metadata.alternates.canonical, seo.canonicalUrl(path));
    assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
    assert.equal(metadata.openGraph.title, title);
    assert.equal(metadata.openGraph.description, description);
    assert.equal(metadata.openGraph.type, 'website');
    assert.equal(metadata.openGraph.siteName, 'Blue by Imergene');
    assert.equal(metadata.openGraph.images[0].url, `${seo.SITE_URL}/opengraph-image`);
    assert.equal(metadata.openGraph.images[0].width, 1200);
    assert.equal(metadata.openGraph.images[0].height, 630);
    assert.ok(metadata.openGraph.images[0].alt);
    assert.equal(metadata.twitter.card, 'summary_large_image');
    assert.equal(metadata.twitter.title, title);
    assert.equal(metadata.twitter.description, description);
    assert.deepEqual(metadata.twitter.images, [metadata.openGraph.images[0].url]);
  }
});

test('curated indexable paths contain only existing public canonical content', () => {
  assert.deepEqual([...seo.INDEXABLE_PATHS], [
    '/', '/pricing', '/docs', '/product/agents', '/guides/ai-coding-assistant-for-students',
    '/contact', '/privacy', '/terms', '/refund',
  ]);
  assert.equal(new Set(seo.INDEXABLE_PATHS).size, seo.INDEXABLE_PATHS.length);
  for (const path of seo.INDEXABLE_PATHS) {
    const page = new URL(`../app${path === '/' ? '' : path}/page.tsx`, import.meta.url);
    assert.ok(existsSync(page), `Missing public page ${path}`);
    assert.equal(seo.canonicalUrl(path), `${seo.SITE_URL}${path}`);
    assert.doesNotMatch(path, /^\/(?:api|console|checkout)(?:\/|$)/);
  }
  for (const path of [...privatePaths, '/subscribe', '/api/auth/send-otp', '/blog', '/status', '/changelog']) {
    assert.equal(seo.INDEXABLE_PATHS.includes(path), false, `${path} must not enter curated sitemap`);
  }
});

test('sitemap emits the curated canonical URLs without fabricated modification dates', () => {
  const sitemap = loadModule('app/sitemap.ts', { '@/lib/seo': seo }).default();
  assert.deepEqual(plain(sitemap), seo.INDEXABLE_PATHS.map(path => ({ url: seo.canonicalUrl(path) })));
  for (const entry of sitemap) assert.deepEqual(Object.keys(entry), ['url']);
});

test('robots advertises the production sitemap and leaves noindex pages crawlable', () => {
  const robots = loadModule('app/robots.ts', { '@/lib/seo': seo }).default();
  assert.equal(robots.sitemap, `${seo.SITE_URL}/sitemap.xml`);
  assert.equal(robots.host, seo.SITE_URL);
  assert.deepEqual(plain(robots.rules), { userAgent: '*', allow: '/', disallow: ['/api/'] });
  for (const path of privatePaths) assert.equal(robots.rules.disallow.some(prefix => path.startsWith(prefix)), false);
  assert.equal(robots.rules.disallow.some(prefix => '/_next/static/app.js'.startsWith(prefix)), false);
});

test('every curated public route exports its own canonical metadata rather than inheriting the homepage URL', () => {
  const metadataSources = {
    '/': 'app/page.tsx', '/pricing': 'app/pricing/page.tsx', '/docs': 'app/docs/page.tsx',
    '/product/agents': 'app/product/agents/page.tsx',
    [seo.STUDENT_GUIDE_PATH]: 'app/guides/ai-coding-assistant-for-students/page.tsx',
    '/contact': 'app/contact/layout.tsx', '/privacy': 'app/privacy/layout.tsx',
    '/terms': 'app/terms/layout.tsx', '/refund': 'app/refund/layout.tsx',
  };
  const titles = new Set();
  for (const path of seo.INDEXABLE_PATHS) {
    const metadata = routeMetadata(metadataSources[path]);
    assert.equal(metadata.alternates.canonical, seo.canonicalUrl(path));
    assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
    assert.ok(metadata.title);
    assert.ok(metadata.description);
    assert.equal(titles.has(metadata.title), false, `Duplicate public title ${metadata.title}`);
    titles.add(metadata.title);
  }
});

test('root defaults support production metadata and public search snippets without a global homepage canonical', () => {
  const metadata = routeMetadata('app/layout.tsx');
  assert.equal(metadata.metadataBase.href, `${seo.SITE_URL}/`);
  assert.equal(metadata.title.default, seo.HOME_TITLE);
  assert.equal(metadata.description, seo.HOME_DESCRIPTION);
  assert.equal(metadata.robots.index, true);
  assert.equal(metadata.robots.googleBot.index, true);
  assert.equal(metadata.robots.googleBot['max-snippet'], -1);
  assert.equal(metadata.robots.googleBot['max-image-preview'], 'large');
  assert.equal(metadata.alternates, undefined);
});

test('private metadata and its route layouts consistently disable indexing', () => {
  const metadata = seo.privatePageMetadata('Private Blue page');
  assert.equal(metadata.title, 'Private Blue page');
  assert.deepEqual(metadata.robots, { index: false, follow: false, googleBot: { index: false, follow: false } });
  for (const path of ['app/console/layout.tsx', 'app/checkout/layout.tsx', 'app/blue-pro/checkout/layout.tsx', 'app/blue-pro/dashboard/layout.tsx']) {
    assert.deepEqual(plain(routeMetadata(path).robots), metadata.robots, `Noindex missing in ${path}`);
  }
});

test('response headers reinforce noindex only on API/account/checkout routes', async () => {
  const config = loadModule('next.config.js', { 'next/constants': { PHASE_DEVELOPMENT_SERVER: 'phase-development-server' } })('phase-development-server');
  const headers = await config.headers();
  const rules = headers.filter(rule => rule.headers.some(header => header.key.toLowerCase() === 'x-robots-tag'));
  assert.deepEqual(plain(rules.map(rule => rule.source)), [
    '/api/:path*', '/console/:path*', '/checkout/:path*', '/blue-pro/checkout/:path*', '/blue-pro/dashboard/:path*',
  ]);
  for (const rule of rules) assert.deepEqual(plain(rule.headers), [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
  const general = headers.find(rule => rule.source === '/:path*');
  assert.ok(general);
  assert.equal(general.headers.some(header => header.key.toLowerCase() === 'x-robots-tag'), false);
  assert.ok(general.headers.some(header => header.key === 'X-Content-Type-Options' && header.value === 'nosniff'));
});

test('JSON-LD rendering escapes closing script delimiters without changing the data', () => {
  const JsonLd = loadModule('app/components/JsonLd.tsx', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  }).default;
  const data = { description: '</script><script>alert("not executable")</script>', nested: { value: '<!-- <&>' } };
  const rendered = JsonLd({ data });
  assert.equal(rendered.type, 'script');
  assert.equal(rendered.props.type, 'application/ld+json');
  const html = rendered.props.dangerouslySetInnerHTML.__html;
  assert.doesNotMatch(html, /</);
  assert.ok(html.includes('\\u003c/script>'));
  assert.deepEqual(JSON.parse(html), data);
});

test('organization, website and Desktop schemas use factual types and resolvable publisher references', () => {
  assert.equal(seo.SITE_SCHEMA['@context'], 'https://schema.org');
  const graph = seo.SITE_SCHEMA['@graph'];
  const organization = graph.find(entity => entity['@type'] === 'Organization');
  const website = graph.find(entity => entity['@type'] === 'WebSite');
  assert.ok(organization);
  assert.ok(website);
  assert.equal(organization.name, 'IMERGENE');
  assert.equal(organization.url, seo.SITE_URL);
  assert.equal(organization.logo, `${seo.SITE_URL}/images/blue-symbol.png`);
  assert.equal(website.name, 'Blue');
  assert.equal(website.url, seo.SITE_URL);
  assert.equal(website.publisher['@id'], organization['@id']);
  const desktop = seo.DESKTOP_APP_SCHEMA;
  assert.equal(desktop['@context'], 'https://schema.org');
  assert.equal(desktop['@type'], 'SoftwareApplication');
  assert.equal(desktop.name, 'Blue Desktop');
  assert.equal(desktop.operatingSystem, 'Windows');
  assert.equal(desktop.applicationCategory, 'DeveloperApplication');
  assert.equal(desktop.description, seo.HOME_DESCRIPTION);
  assert.equal(desktop.publisher['@id'], organization['@id']);
  assert.equal(desktop.downloadUrl, 'https://apps.microsoft.com/detail/9NHV6GFJ64C8');
  const ids = [...graph.map(entity => entity['@id']), desktop['@id']];
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(id.startsWith(`${seo.SITE_URL}/#`));
  const schemas = JSON.stringify([seo.SITE_SCHEMA, desktop]);
  assert.doesNotMatch(schemas, /"(?:aggregateRating|review|ratingValue|ratingCount|softwareVersion|priceValidUntil)"\s*:/);
  assert.doesNotMatch(schemas, /localhost|127\.0\.0\.1|5\.0 out of|100% uptime/);
});
