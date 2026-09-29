'use strict';

// Local visual/interaction checks only: no sign-in, backend writes or deployment.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const url = new URL(process.env.BLUE_TESTIMONIALS_PREVIEW_URL || 'http://127.0.0.1:3017');
if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
  throw new Error('Testimonials checks only accept a loopback preview without credentials.');
}
const names = ['Shivani Patil', 'Vaishnavi Chavare', 'sanika Chabuk', 'Shruti Chougule', 'deepakpatilt8123', 'Om Karande', 'Soham Phatak', 'Om Mali'];

async function main() {
  const output = process.env.BLUE_TESTIMONIALS_ARTIFACT_DIR || await fs.mkdtemp(path.join(os.tmpdir(), 'blue-testimonials-review-'));
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BLUE_TESTIMONIALS_CHROMIUM_EXECUTABLE || process.env.BLUE_HERO_CHROMIUM_EXECUTABLE || undefined });
  const passed = [];
  const errors = [];
  let diagnosticPage;
  function pass(message) { passed.push(message); console.log('PASS ' + message); }
  try {
    async function newPage(options = {}, theme = 'light') {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, reducedMotion: 'no-preference', ...options });
      await context.addInitScript(theme => {
        localStorage.setItem('blue-cookie-consent', 'essential');
        localStorage.setItem('blue-ai-theme', theme);
      }, theme);
      await context.route('**/*', route => {
        const target = new URL(route.request().url());
        if (target.origin !== url.origin) return route.abort();
        if (target.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(route.request().method())) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Local visual test: backend disabled"}' });
        return route.continue();
      });
      const page = await context.newPage();
      diagnosticPage = page;
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydration|did not match/i.test(message.text())) errors.push(message.text()); });
      page.setDefaultTimeout(15000);
      await page.goto(url.href, { waitUntil: 'networkidle' });
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      const section = page.locator('#testimonials');
      await section.scrollIntoViewIfNeeded();
      const stack = section.locator('.rb-review-stack');
      await stack.waitFor();
      return { context, page, section, stack };
    }
    async function index(stack, expected) {
      await stack.page().waitForFunction(expected => document.querySelector('.rb-review-stack')?.dataset.stackIndex === String(expected), expected);
      assert.equal(await stack.locator('[data-stack-active="true"] article p').innerText(), names[expected]);
    }
    async function readable(stack) {
      const measurements = await stack.locator('[data-stack-active="true"] article').evaluate(element => {
        // Compare untransformed layout: a rotated bounding box overlaps its
        // neighbor even when the actual flex layout is correctly separated.
        const quote = element.querySelector('blockquote');
        const author = element.lastElementChild;
        return { overflow: element.scrollHeight > element.clientHeight + 1, quoteInside: quote.offsetTop >= element.offsetTop && quote.offsetTop + quote.offsetHeight <= author.offsetTop + 1, authorInside: author.offsetTop + author.offsetHeight <= element.offsetTop + element.offsetHeight + 1 };
      });
      assert.deepEqual(measurements, { overflow: false, quoteInside: true, authorInside: true }, 'Review content must not be clipped');
    }
    async function themed(stack, expectedSurface, expectedInk) {
      const colors = await stack.locator('[data-stack-active="true"] article').evaluate(element => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }));
      assert.deepEqual(colors, { background: expectedSurface, color: expectedInk });
    }
    async function capture(test, filename) {
      await test.section.scrollIntoViewIfNeeded();
      await test.page.waitForTimeout(350);
      await test.section.screenshot({ path: path.join(output, filename) });
    }

    const desktop = await newPage();
    await index(desktop.stack, 0);
    await themed(desktop.stack, 'rgb(255, 255, 255)', 'rgb(23, 32, 51)');
    assert.equal(await desktop.section.getByRole('link', { name: 'Read the original reviews' }).getAttribute('href'), 'https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant&ssr=false#review-details');
    assert.equal(await desktop.section.getByText('8 public Marketplace reviews', { exact: true }).count(), 1);
    assert.equal(await desktop.section.locator('.rb-stack-layer[aria-hidden="false"]').count(), 1);
    for (let i = 0; i < names.length; i++) {
      await index(desktop.stack, i);
      await readable(desktop.stack);
      await desktop.section.getByRole('button', { name: 'Next review', exact: true }).click();
    }
    await index(desktop.stack, 0);
    await desktop.section.getByRole('button', { name: 'Previous review', exact: true }).click();
    await index(desktop.stack, 7);
    pass('light theme: all eight real reviews readable; next/previous wrap correctly');

    await desktop.section.getByRole('button', { name: 'Show review by Shivani Patil', exact: true }).click();
    await desktop.stack.focus();
    await desktop.page.keyboard.press('ArrowLeft');
    await index(desktop.stack, 7);
    await desktop.page.keyboard.press('ArrowRight');
    await index(desktop.stack, 0);
    await desktop.page.keyboard.press('End');
    await index(desktop.stack, 7);
    await desktop.page.keyboard.press('Home');
    await index(desktop.stack, 0);
    await desktop.section.getByRole('button', { name: 'Show review by Shruti Chougule', exact: true }).click();
    await index(desktop.stack, 3);
    pass('keyboard, direct review selection and accessible front-card labeling work');

    const departing = await desktop.stack.locator('[data-card-index="3"]').elementHandle();
    const beforeRestack = await departing.evaluate(element => getComputedStyle(element).transform);
    await desktop.stack.locator('[data-stack-active="true"] article').click({ position: { x: 30, y: 30 } });
    await index(desktop.stack, 4);
    assert.equal(await departing.evaluate(element => element.isConnected && element.dataset.stackActive === 'false'), true, 'Send-to-back keeps the same outgoing card mounted');
    await desktop.page.waitForFunction(before => getComputedStyle(document.querySelector('[data-card-index="3"]')).transform !== before, beforeRestack);
    await desktop.page.waitForTimeout(3200);
    await index(desktop.stack, 4);
    assert.equal(await desktop.stack.locator('.rb-stack-layer').count(), 8);
    const scales = await desktop.stack.evaluate(element => {
      const scale = card => { const matrix = new DOMMatrixReadOnly(getComputedStyle(card).transform); return Math.hypot(matrix.a, matrix.b); };
      return { front: scale(element.querySelector('[data-stack-active="true"]')), back: scale(element.querySelector('[data-card-index="3"]')) };
    });
    assert.ok(Math.abs(scales.front - .94) < .002 && Math.abs(scales.back - .52) < .002, 'Original eight-card Stack scale formula must be preserved');
    pass('original eight-card spring restacking/scaling; outgoing card stays mounted; no autoplay');

    await desktop.stack.scrollIntoViewIfNeeded();
    const bounds = await desktop.stack.boundingBox();
    await desktop.page.mouse.move(bounds.x + bounds.width * .4, bounds.y + 45);
    await desktop.page.mouse.down();
    await desktop.page.mouse.move(bounds.x + bounds.width * .4 + 220, bounds.y + 45, { steps: 20 });
    await desktop.page.mouse.up();
    await index(desktop.stack, 5);
    await desktop.page.waitForTimeout(500);
    assert.equal(await desktop.stack.locator('[data-stack-active="true"]').locator('..').evaluate(element => getComputedStyle(element).transform), 'none');
    pass('drag cycles once and resets its offset without a duplicate click');

    // Theme switches must not reset the selected review.
    await desktop.page.getByRole('button', { name: 'Dark theme', exact: true }).click();
    await desktop.page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await index(desktop.stack, 5);
    await themed(desktop.stack, 'rgb(28, 33, 40)', 'rgb(232, 234, 237)');
    await capture(desktop, 'desktop-dark.png');
    pass('dark theme uses existing palette; switching theme preserves the review');
    await desktop.page.getByRole('button', { name: 'Light theme', exact: true }).click();
    await desktop.page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await desktop.section.getByRole('button', { name: 'Show review by Shivani Patil', exact: true }).click();
    await capture(desktop, 'desktop-light.png');
    await desktop.section.locator('summary').click();
    assert.equal(await desktop.section.locator('details[open] article').count(), 8);
    for (const name of names) assert.equal(await desktop.section.locator('details[open]').getByText(name, { exact: true }).count(), 1);
    pass('read-all view exposes every review without carousel interaction');
    await desktop.context.close();

    for (const width of [390, 320, 1024]) {
      const mobile = width < 768;
      const view = await newPage({ viewport: { width, height: 1200 }, isMobile: mobile, hasTouch: mobile });
      assert.equal(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow at ${width}px`);
      if (mobile) assert.equal(await view.stack.getAttribute('data-drag-enabled'), 'false');
      for (let i = 0; i < names.length; i++) {
        await view.section.getByRole('button', { name: `Show review by ${names[i]}`, exact: true }).click();
        await index(view.stack, i);
        await readable(view.stack);
      }
      if (mobile) {
        await view.stack.locator('[data-stack-active="true"] article').tap({ position: { x: 30, y: 30 } });
        await index(view.stack, 0);
      }
      await capture(view, `viewport-${width}.png`);
      pass(`${width}px: no overflow or clipped reviews${mobile ? '; touch uses click-only cards' : ''}`);
      await view.context.close();
    }

    const reduced = await newPage({ reducedMotion: 'reduce' }, 'dark');
    assert.equal(await reduced.stack.getAttribute('data-reduced-motion'), 'true');
    assert.equal(await reduced.stack.getAttribute('data-drag-enabled'), 'false');
    assert.ok(await reduced.stack.locator('.rb-stack-layer').evaluateAll(elements => elements.every(element => getComputedStyle(element).transform === 'none')));
    await reduced.stack.focus();
    await reduced.page.keyboard.press('ArrowRight');
    await index(reduced.stack, 1);
    await readable(reduced.stack);
    pass('reduced motion removes transforms while review navigation still works');
    await reduced.context.close();
    assert.deepEqual(errors, []);
    pass('no uncaught browser errors');
    console.log(JSON.stringify({ passed, screenshots: output }, null, 2));
  } catch (error) {
    if (diagnosticPage && !diagnosticPage.isClosed()) {
      console.error('Stack diagnostic:', await diagnosticPage.locator('.rb-review-stack').evaluate(element => ({
        bounds: element.getBoundingClientRect().toJSON(),
        cards: Array.from(element.querySelectorAll('.rb-stack-layer')).map(card => ({
          active: card.dataset.stackActive, bounds: card.getBoundingClientRect().toJSON(),
          transform: getComputedStyle(card).transform, opacity: getComputedStyle(card).opacity,
        })),
      })).catch(() => null));
      await diagnosticPage.locator('#testimonials').screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
