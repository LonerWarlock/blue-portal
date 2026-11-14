const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const http = require('node:http');

const base = new URL(process.env.BLUE_SEO_TEST_URL || 'http://127.0.0.1:3005');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || base.username || base.password) throw new Error('SEO HTTP checks accept only a local preview.');
const origin = 'https://blue.imergene.in';
const routes = ['/', '/desktop', '/pricing', '/docs', '/download', '/hi/download', '/compare/emergent', '/compare/codex'];
const pages = new Map();
const localTest = (name, fn) => test(name, { skip: !process.env.BLUE_SEO_TEST_URL }, fn);
async function page(path) {
  if (!pages.has(path)) {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, path);
    pages.set(path, new JSDOM(await response.text()).window.document);
  }
  return pages.get(path);
}

localTest('all review URLs serve distinct, indexable HTML with a single H1 and production canonical', async () => {
  const titles = new Set();
  for (const path of routes) {
    const document = await page(path);
    assert.equal(document.querySelectorAll('h1').length, 1, path);
    const title = document.title;
    assert.ok(title && !titles.has(title), `Distinct page title: ${path}`); titles.add(title);
    assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1, path);
    assert.equal(new URL(document.querySelector('link[rel="canonical"]').getAttribute('href')).href, origin + path, path);
    assert.ok(document.querySelector('meta[name="description"]').getAttribute('content'));
    assert.doesNotMatch(document.querySelector('meta[name="robots"]')?.getAttribute('content') || '', /noindex/);
  }
});

localTest('download translations reciprocate language URLs and serve real Hindi instructions', async () => {
  for (const path of ['/download', '/hi/download']) {
    const document = await page(path);
    for (const [language, target] of [['en', '/download'], ['hi', '/hi/download'], ['x-default', '/download']]) {
      assert.equal(document.querySelector(`link[rel="alternate"][hreflang="${language}"]`)?.getAttribute('href'), origin + target);
    }
  }
  const hindi = await page('/hi/download');
  assert.equal(hindi.querySelector('article').getAttribute('lang'), 'hi');
  assert.match(hindi.querySelector('h1').textContent, /डाउनलोड/);
  assert.equal(hindi.querySelectorAll('article ol li').length, 4);
  assert.ok(hindi.querySelector('a[href*="apps.microsoft.com/detail/9NHV6GFJ64C8"]'));
});

localTest('comparison HTML has sourced prices, fair subagent facts, and no competitor media or engine-origin claims', async () => {
  for (const product of ['emergent', 'codex']) {
    const document = await page('/compare/' + product);
    const article = document.querySelector('article');
    assert.equal(article.querySelectorAll('img, video, iframe, canvas').length, 0);
    const text = article.textContent.replace(/\s+/g, ' ');
    assert.match(text, /₹149 \/ \$1\.99/);
    assert.match(text, /0 Blue Credits included/);
    assert.match(text, /₹115 or \$1\.30 per credit/);
    assert.match(text, /₹2,875 or \$32\.50/);
    assert.doesNotMatch(text, /30% platform fee|faster than|outperforms|\d+% faster/i);
    assert.doesNotMatch(text, /Blue (?:uses|runs on|is powered by) (?:the )?(?:Codex|OpenCode) (?:engine|runtime)/i);
    for (const source of article.querySelectorAll('a[href^="#source-"]')) assert.ok(document.querySelector(source.getAttribute('href')));
  }
  const codex = (await page('/compare/codex')).querySelector('article').textContent;
  assert.match(codex, /Supports subagents, parallel assignments/);
  assert.match(codex, /Plus: \$20\/month/);
  assert.match(codex, /Pro: From \$100\/month/);
  const emergent = (await page('/compare/emergent')).querySelector('article').textContent;
  assert.match(emergent, /Standard: \$20\/month, billed annually/);
});

localTest('new public pages are discoverable through visible links and the sitemap', async () => {
  const document = await page('/');
  const response = await fetch(new URL('/sitemap.xml', base));
  assert.equal(response.status, 200);
  const sitemap = new JSDOM(await response.text(), { contentType: 'application/xml' }).window.document;
  const locations = [...sitemap.querySelectorAll('loc')].map(node => node.textContent);
  for (const path of ['/download', '/hi/download', '/compare/codex', '/compare/emergent']) {
    assert.ok(document.querySelector(`a[href="${path}"]`), path);
    assert.ok(locations.includes(origin + path), path);
  }
  assert.equal(document.querySelectorAll('a[href="/compare/opencode"]').length, 0);
});

localTest('legacy-host public links preserve their path when redirecting to the canonical site', async () => {
  for (const path of ['/download', '/hi/download', '/compare/codex', '/compare/emergent']) {
    // Native HTTP preserves Host; fetch may replace it with the URL authority.
    const response = await new Promise((resolve, reject) => {
      const request = http.get(new URL(path, base), { headers: { Host: 'blue-by-imergene.vercel.app' } }, incoming => {
        incoming.resume(); resolve({ status: incoming.statusCode, location: incoming.headers.location });
      });
      request.on('error', reject);
      request.setTimeout(30000, () => request.destroy(new Error('Local redirect check timed out')));
    });
    assert.equal(response.status, 308);
    assert.equal(response.location, origin + path);
  }
});
