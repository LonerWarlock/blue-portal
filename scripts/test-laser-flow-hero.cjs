'use strict';

// Run against a local preview only. No sign-in, model, payment or deployment calls.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const url = new URL(process.env.BLUE_HERO_PREVIEW_URL || 'http://127.0.0.1:3015');
if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
  throw new Error('Hero checks only accept a loopback preview without credentials.');
}

async function main() {
  const output = process.env.BLUE_HERO_ARTIFACT_DIR || await fs.mkdtemp(path.join(os.tmpdir(), 'blue-hero-review-'));
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BLUE_HERO_CHROMIUM_EXECUTABLE || undefined,
    args: ['--enable-unsafe-swiftshader']
  });
  console.log('Local browser ready; checking homepage.');
  const passed = [];
  let diagnosticPage;
  try {
    async function newPage(options = {}) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1300 }, reducedMotion: 'no-preference', ...options });
      // Only this isolated test profile: keep the consent dialog from obscuring
      // the animation. Production consent handling stays unchanged.
      await context.addInitScript(() => localStorage.setItem('blue-cookie-consent', 'essential'));
      await context.route('**/*', route => {
        const request = route.request();
        const target = new URL(request.url());
        // All browser traffic stays local, with writes and backend routes stubbed.
        if (target.origin !== url.origin) return route.abort();
        if (target.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
          return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Local visual test: backend disabled"}' });
        }
        return route.continue();
      });
      const page = await context.newPage();
      diagnosticPage = page;
      page.setDefaultTimeout(45000);
      return { page, context };
    }
    // Fit the figure in the viewport before hovering. A full-page screenshot
    // temporarily changes touch/visibility emulation in Chromium.
    async function captureFigure(page, figure, name) {
      await figure.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await figure.screenshot({ path: path.join(output, name) });
    }

    const desktop = await newPage();
    const errors = [];
    desktop.page.on('pageerror', error => errors.push(error.message));
    await desktop.page.addInitScript(() => {
      window.__blueHeroDraws = 0;
      const original = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        window.__blueHeroDraws += 1;
        return original.apply(this, args);
      };
    });
    await desktop.page.goto(url.href, { waitUntil: 'networkidle' });
    console.log('Homepage loaded; checking animation and layout.');
    const stage = desktop.page.locator('[data-blue-laser-hero]');
    const figure = desktop.page.locator('[data-blue-laser-figure]');
    await stage.scrollIntoViewIfNeeded();
    await desktop.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.animation === 'animated');
    await desktop.page.waitForFunction(() => window.__blueHeroDraws > 3);
    assert.equal(await stage.locator('canvas').count(), 1);
    assert.ok(await stage.locator('canvas').evaluate(canvas => canvas.width > 300 && canvas.height > 150), 'Canvas must match the stage, including after Strict Mode remount');
    passed.push('desktop: actual WebGL animation renders, exactly one canvas');

    const links = desktop.page.getByRole('link', { name: 'Get Started for Free', exact: true });
    assert.equal(await links.first().getAttribute('href'), '/console');
    assert.equal(await desktop.page.getByRole('link', { name: 'Book a Demo', exact: true }).getAttribute('href'), '/contact');
    assert.equal(await desktop.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    const preview = figure.locator('[data-blue-desktop-preview] img');
    assert.equal(await preview.getAttribute('src'), '/images/blue-desktop-preview.png');
    await preview.evaluate(image => image.decode());
    const imageBounds = await preview.boundingBox();
    const stageBounds = await stage.boundingBox();
    const separatorBounds = await stage.locator('[data-blue-laser-separator]').boundingBox();
    assert.ok(Math.abs(imageBounds.y - (separatorBounds.y + separatorBounds.height)) <= 1, 'The preview must sit immediately below the beam separator');
    assert.equal(await stage.locator('img').count(), 0, 'Desktop preview must be outside the beam area');
    assert.ok(Math.abs(stageBounds.width - 1440) <= 1, 'The beam must be full width, outside the old constrained parent');
    assert.deepEqual(await stage.evaluate(element => ({ border: getComputedStyle(element).borderTopWidth, radius: getComputedStyle(element).borderTopLeftRadius })), { border: '0px', radius: '0px' });
    passed.push('desktop: original actions preserved, no horizontal overflow');
    passed.push('layout: no outer box; separator and actual Desktop preview below the beam');

    await desktop.page.screenshot({ path: path.join(output, 'desktop.png') });
    await captureFigure(desktop.page, figure, 'desktop-panel.png');
    await stage.scrollIntoViewIfNeeded();
    const bounds = await stage.boundingBox();
    assert.ok(bounds);
    await desktop.page.mouse.move(bounds.x + bounds.width * 0.46, bounds.y + bounds.height * 0.43);
    await desktop.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.reveal === 'true');
    await desktop.page.waitForTimeout(250);
    const reveal = await stage.evaluate(element => ({ x: element.style.getPropertyValue('--reveal-x'), y: element.style.getPropertyValue('--reveal-y') }));
    assert.match(reveal.x, /px$/);
    assert.match(reveal.y, /px$/);
    const launchReveal = stage.locator('[data-blue-launch-reveal]');
    assert.equal(await launchReveal.innerText(), 'Blue Desktop.\nLaunching soon');
    assert.equal(await launchReveal.evaluate(element => getComputedStyle(element).opacity), '1');
    assert.match(await launchReveal.evaluate(element => getComputedStyle(element).maskImage), /radial-gradient/);
    await captureFigure(desktop.page, figure, 'hover.png');
    const exitBounds = await stage.boundingBox();
    await desktop.page.mouse.move(1, exitBounds.y + exitBounds.height + 4);
    await desktop.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.reveal === 'false');
    passed.push('hover: cursor reveals Blue Desktop / Launching soon, clears on leaving');

    await desktop.page.getByRole('button', { name: 'Pause animation', exact: true }).click();
    assert.equal(await stage.getAttribute('data-animation'), 'paused');
    assert.equal(await stage.locator('canvas').count(), 0);
    const play = desktop.page.getByRole('button', { name: 'Play animation', exact: true });
    assert.equal(await play.getAttribute('aria-pressed'), 'true');
    const controlBounds = await play.boundingBox();
    assert.ok(controlBounds.height >= 44, 'Animation control must have a comfortable hit target');
    assert.ok(await play.evaluate(element => !element.closest('[aria-hidden="true"]')), 'Pause/play must stay accessible');
    await play.focus();
    await desktop.page.keyboard.press('Enter');
    await desktop.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.animation === 'animated');
    assert.equal(await stage.locator('canvas').count(), 1);
    passed.push('pause: releases the canvas; keyboard resume works');

    await desktop.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await desktop.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.animation === 'offscreen');
    assert.equal(await stage.locator('canvas').count(), 0);
    await desktop.page.evaluate(() => { window.__blueHeroIdleSample = { draws: -1, since: performance.now() }; });
    await desktop.page.waitForFunction(() => {
      const sample = window.__blueHeroIdleSample;
      if (sample.draws !== window.__blueHeroDraws) { sample.draws = window.__blueHeroDraws; sample.since = performance.now(); }
      return performance.now() - sample.since >= 400;
    }, null, { polling: 100, timeout: 7000 });
    const before = await desktop.page.evaluate(() => window.__blueHeroDraws);
    await desktop.page.waitForTimeout(400);
    assert.equal(await desktop.page.evaluate(() => window.__blueHeroDraws), before);
    passed.push('performance: GPU drawing stops while the hero is offscreen');

    await stage.scrollIntoViewIfNeeded();
    await stage.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
    await desktop.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.animation === 'unavailable');
    assert.equal(await stage.locator('canvas').count(), 0);
    assert.deepEqual(errors, []);
    passed.push('context loss: static fallback, no uncaught page errors');
    console.log('Desktop and hover checks passed; checking mobile and fallbacks.');
    await desktop.context.close();

    const mobile = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.page.goto(url.href, { waitUntil: 'networkidle' });
    await mobile.page.locator('[data-blue-laser-hero]').scrollIntoViewIfNeeded();
    await mobile.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.animation !== 'pending');
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(await mobile.page.getByText('Move your cursor to explore', { exact: true }).count(), 0);
    assert.equal(await mobile.page.locator('[data-blue-launch-static]').evaluate(element => getComputedStyle(element).opacity), '0.85');
    await mobile.page.screenshot({ path: path.join(output, 'mobile.png') });
    await captureFigure(mobile.page, mobile.page.locator('[data-blue-laser-figure]'), 'mobile-panel.png');
    passed.push('mobile: responsive layout, no hover-only instruction or overflow');
    await mobile.context.close();

    const reduced = await newPage({ reducedMotion: 'reduce' });
    await reduced.page.goto(url.href, { waitUntil: 'networkidle' });
    const reducedStage = reduced.page.locator('[data-blue-laser-hero]');
    await reducedStage.scrollIntoViewIfNeeded();
    await reduced.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.animation === 'reduced-motion');
    assert.equal(await reducedStage.locator('canvas').count(), 0);
    assert.equal(await reduced.page.getByRole('button', { name: 'Pause animation', exact: true }).count(), 0);
    assert.equal(await reducedStage.locator('[data-blue-launch-static]').evaluate(element => getComputedStyle(element).opacity), '0.85');
    await captureFigure(reduced.page, reduced.page.locator('[data-blue-laser-figure]'), 'reduced-motion.png');
    passed.push('accessibility: reduced motion renders a static preview without WebGL');
    await reduced.page.emulateMedia({ reducedMotion: 'no-preference' });
    await reduced.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.animation === 'animated');
    passed.push('accessibility: a changed motion preference is respected live');
    await reduced.context.close();

    const saving = await newPage();
    await saving.page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));
    await saving.page.goto(url.href, { waitUntil: 'networkidle' });
    const savingStage = saving.page.locator('[data-blue-laser-hero]');
    await savingStage.scrollIntoViewIfNeeded();
    await saving.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.animation === 'save-data');
    assert.equal(await savingStage.locator('canvas').count(), 0);
    assert.equal(await savingStage.locator('[data-blue-launch-static]').evaluate(element => getComputedStyle(element).opacity), '0.85');
    passed.push('data saving: readable launch text without the GPU renderer');
    await saving.context.close();

    const dark = await newPage({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await dark.page.goto(url.href, { waitUntil: 'networkidle' });
    await dark.page.locator('[data-blue-laser-hero]').scrollIntoViewIfNeeded();
    await dark.page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await captureFigure(dark.page, dark.page.locator('[data-blue-laser-figure]'), 'dark.png');
    assert.equal(await dark.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    passed.push('dark theme: full-width visual and original layout remain usable');
    await dark.context.close();

    const unsupported = await newPage();
    await unsupported.page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (String(type).startsWith('webgl')) return null;
        return original.call(this, type, ...args);
      };
    });
    await unsupported.page.goto(url.href, { waitUntil: 'networkidle' });
    const unsupportedStage = unsupported.page.locator('[data-blue-laser-hero]');
    await unsupportedStage.scrollIntoViewIfNeeded();
    await unsupported.page.waitForFunction(() => document.querySelector('[data-blue-laser-hero]')?.dataset.animation === 'unavailable');
    assert.equal(await unsupportedStage.locator('canvas').count(), 0);
    passed.push('compatibility: missing WebGL falls back without breaking the page');
    await unsupported.page.goto(new URL('/blue-pro/checkout', url).href, { waitUntil: 'networkidle' });
    assert.equal(await unsupported.page.locator('[data-blue-laser-hero]').count(), 0);
    passed.push('scope: no animation on checkout');
    await unsupported.context.close();

    console.log(JSON.stringify({ passed, screenshots: output }, null, 2));
  } catch (error) {
    if (diagnosticPage && !diagnosticPage.isClosed()) {
      // A stalled navigation can also stall evaluate: diagnostics must not
      // turn a bounded test failure into an endless wait.
      const diagnostic = await Promise.race([diagnosticPage.evaluate(() => {
        const stage = document.querySelector('[data-blue-laser-hero]');
        const canvas = stage?.querySelector('canvas');
        return { mode: stage?.dataset.animation, reveal: stage?.dataset.reveal, draws: window.__blueHeroDraws, bounds: stage?.getBoundingClientRect().toJSON(), canvas: canvas ? { width: canvas.width, height: canvas.height, bounds: canvas.getBoundingClientRect().toJSON() } : null, viewport: { width: innerWidth, height: innerHeight }, hidden: document.hidden, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
      }).catch(() => null), new Promise(resolve => setTimeout(() => resolve('Diagnostic timed out'), 2000))]);
      console.error('Hero diagnostic:', JSON.stringify(diagnostic));
      await diagnosticPage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true, timeout: 5000 }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
