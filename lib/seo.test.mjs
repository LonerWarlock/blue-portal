import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as seo from './seo.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const seoRedirects = require('./seoRedirects.cjs');
const chunkRecovery = require('./chunk-recovery.cjs');
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
  assert.equal(seo.SITE_URL, 'https://blue.imergene.in');
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
    '/', '/pricing', '/teams', '/docs', '/product/agents', '/guides/ai-coding-assistant-for-students', '/guides/ai-agent-teams',
    '/about', '/contact', '/privacy', '/terms', '/refund',
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
    '/': 'app/page.tsx', '/pricing': 'app/pricing/page.tsx', '/teams': 'app/teams/page.tsx', '/docs': 'app/docs/page.tsx',
    '/product/agents': 'app/product/agents/page.tsx',
    [seo.STUDENT_GUIDE_PATH]: 'app/guides/ai-coding-assistant-for-students/page.tsx',
    [seo.TEAM_GUIDE_PATH]: 'app/guides/ai-agent-teams/page.tsx',
    '/about': 'app/about/page.tsx',
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
  assert.equal(metadata.applicationName, seo.SITE_NAME);
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

test('unfinished or unverified marketing routes are not promoted as searchable product pages', () => {
  for (const path of ['/blog', '/changelog', '/community', '/status', '/services', '/enterprise']) {
    const metadata = routeMetadata(`app${path}/layout.tsx`);
    assert.equal(metadata.robots.index, false, `${path} must not be indexed before content is ready`);
    assert.equal(metadata.robots.follow, true);
    assert.equal(seo.INDEXABLE_PATHS.includes(path), false);
    assert.doesNotMatch(readSource('app/components/Footer.tsx'), new RegExp(`href: "${path}"`));
  }
});

test('response headers reinforce noindex only on API/account/checkout routes', async () => {
  const config = loadModule('next.config.js', {
    'next/constants': { PHASE_DEVELOPMENT_SERVER: 'phase-development-server' },
    './lib/seoRedirects.cjs': seoRedirects,
    './lib/chunk-recovery.cjs': chunkRecovery,
  })('phase-development-server');
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
  assert.equal(organization.alternateName, 'Imergene');
  assert.equal(organization.url, seo.SITE_URL);
  assert.equal(organization.logo, `${seo.SITE_URL}/images/blue-symbol.png`);
  assert.equal(website.name, seo.SITE_NAME);
  assert.equal(website.name, 'Blue by Imergene');
  assert.deepEqual(website.alternateName, ['Blue', 'Blue Desktop', 'blue.imergene.in']);
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
  assert.equal(desktop.creator['@id'], organization['@id']);
  assert.equal(desktop.downloadUrl, 'https://apps.microsoft.com/detail/9NHV6GFJ64C8');
  const ids = [...graph.map(entity => entity['@id']), desktop['@id']];
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(id.startsWith(`${seo.SITE_URL}/#`));
  const schemas = JSON.stringify([seo.SITE_SCHEMA, desktop]);
  assert.doesNotMatch(schemas, /"(?:aggregateRating|review|ratingValue|ratingCount|softwareVersion|priceValidUntil)"\s*:/);
  assert.doesNotMatch(schemas, /localhost|127\.0\.0\.1|5\.0 out of|100% uptime/);
});

test('official public facts distinguish Imergene ownership and BYOK from Blue Credits', () => {
  assert.match(seo.HOME_TITLE, /Blue by Imergene/);
  assert.match(seo.HOME_DESCRIPTION, /App subscription access and AI model usage are separate/);
  const about = readSource('app/about/page.tsx');
  assert.match(about, /has not been renamed to Emergent AI/);
  assert.match(about, /not deducted from Blue Credits/);
  assert.match(about, /not itself a separately priced Blue Credit action/);
  assert.match(about, /The official website is <a href="https:\/\/blue\.imergene\.in\/"/);
  assert.doesNotMatch(about, /blue-by-imergene\.vercel\.app/);
  assert.match(readSource('app/components/Footer.tsx'), /href: "\/about"/);
});

test('product facts cover Desktop Teams without fabricated ranking or review claims', () => {
  assert.match(seo.HOME_TITLE, /AI Coding Assistant & Agent Teams/);
  assert.match(seo.HOME_DESCRIPTION, /Blue Desktop for Windows/);
  assert.match(seo.HOME_DESCRIPTION, /VS Code coding assistant/);
  const features = seo.DESKTOP_APP_SCHEMA.featureList.join(' ');
  assert.match(features, /active Teams plan/);
  assert.match(features, /permissions and user sign-in/);
  assert.match(features, /Blue and the computer stay on/);
  const docs = readSource('app/docs/page.tsx');
  assert.match(docs, /id="teams"/);
  assert.match(docs, /href="\/guides\/ai-agent-teams"/);
  assert.doesNotMatch(JSON.stringify(seo.DESKTOP_APP_SCHEMA), /#1|rank first|guaranteed results|always-on cloud/i);
});

test('public documentation attributes the OpenCode runtime and separates it from model access', () => {
  const docs = readSource('app/docs/page.tsx').replace(/\s+/g, ' ');
  assert.match(docs, /In Blue Desktop, connecting an OpenCode Zen API key \(BYOK\) or signing in with OpenCode uses the bundled OpenCode coding-agent runtime for project tasks/);
  assert.match(docs, /OpenCode Zen is a model gateway, not a model or Blue&apos;s own engine/);
  assert.match(docs, /Using the runtime does not guarantee access to every model/);
  assert.match(docs, /These BYOK\/account model requests do not spend Blue Credits/);
  assert.match(docs, /independent product by Imergene, not an official OpenCode product/);
  assert.match(docs, /href="https:\/\/opencode\.ai\/docs\/"/);
  assert.match(docs, /href="https:\/\/opencode\.ai\/docs\/zen\/"/);
  assert.equal(ts.transpileModule(readSource('app/docs/page.tsx'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true,
  }).diagnostics.length, 0);
});

test('homepage verification adds the new Search Console account without removing existing owners', () => {
  const layout = readSource('app/layout.tsx');
  assert.match(layout, /verification:\s*\{\s*google:\s*"PsWJ5-fDX0TuVohHswUfYqo36Xk7CipkY0E68mp6Dwg"/);
  const head = layout.match(/<head>([\s\S]*?)<\/head>/)?.[1];
  assert.ok(head, 'Verification tags must be in the server-rendered head');
  for (const token of [
    'vruaj02oU1QJFSmV1acG52x92IhkDp8oy8v2A2hLfzw',
    'wqF8Sn252JSvcirnIe2eLK68qZCYddKPIeWIk1ILbFU',
  ]) {
    assert.ok(head.includes(`<meta name="google-site-verification" content="${token}" />`));
    assert.equal(layout.split(token).length - 1, 1, 'Do not duplicate verification tags');
  }
});

test('coding-agent page renders useful task examples, checks, product boundaries and canonical breadcrumbs', () => {
  const jsx = (type, props) => ({ type, props: props || {} });
  const page = loadModule('app/product/agents/page.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/link': { default: 'a' },
    '@/app/components/PageLayout': { default: 'main' },
    '@/app/components/AgentLiveDemo': { default: 'AgentLiveDemo' },
    '@/app/components/DesktopDownloadLink': { default: 'DesktopDownloadLink' },
    '@/app/components/JsonLd': { default: 'JsonLd' },
    '@/lib/seo': seo,
  });
  const elements = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    elements.push(node);
    visit(node.props.children);
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join(' ');
    if (node && typeof node === 'object') return text(node.props.children);
    return typeof node === 'string' ? node : '';
  }
  const rendered = page.default();
  visit(rendered);
  const copy = text(rendered).replace(/\s+/g, ' ');
  assert.equal(elements.filter(node => node.type === 'h1').length, 1);
  assert.equal(elements.filter(node => node.type === 'blockquote').length, 3);
  for (const expected of [
    'Blue by Imergene', 'What is an AI coding agent?', 'What to verify',
    'not recorded results or performance claims', 'active Blue Teams plan',
    'not Desktop Team mode', 'App access and model usage are separate',
    'computer on and awake',
  ]) assert.ok(copy.includes(expected), `Missing useful product fact: ${expected}`);
  const breadcrumbs = elements.find(node => node.type === 'JsonLd').props.data;
  assert.equal(breadcrumbs['@type'], 'BreadcrumbList');
  assert.equal(breadcrumbs.itemListElement[1].item, seo.canonicalUrl('/product/agents'));
  assert.equal(breadcrumbs.itemListElement[1].position, 2);
  const hrefs = elements.map(node => node.props.href).filter(Boolean);
  for (const href of ['/docs', '/teams', '/pricing', '/about', seo.STUDENT_GUIDE_PATH, seo.TEAM_GUIDE_PATH]) assert.ok(hrefs.includes(href));
  assert.match(page.metadata.title, /Blue AI Coding Agent for Windows & VS Code/);
  assert.doesNotMatch(copy, /rank first|#1 coding agent|guaranteed ranking|guaranteed correct/i);
});

test('brand and coding-agent discovery use normal visible navigation instead of hidden keyword text', () => {
  const nav = readSource('app/components/Navbar.tsx');
  const footer = readSource('app/components/Footer.tsx');
  const faq = readSource('app/components/CodingAssistantFaq.tsx');
  assert.match(nav, /href: "\/product\/agents", label: "Coding agents"/);
  assert.match(nav, /aria-label="Blue by Imergene home"/);
  assert.match(footer, /label: "AI coding agent", href: "\/product\/agents"/);
  assert.match(faq, /What is an AI coding agent, and how does Blue work\?/);
  assert.match(faq, /href="\/product\/agents"/);
});
