'use strict';

// Capture the real, freshly built Desktop renderer, not an HTML/SVG mockup.
// An empty offline bridge avoids opening an account, model session or project.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const url = new URL(process.env.BLUE_DESKTOP_PREVIEW_URL || 'http://127.0.0.1:4179');
if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
  throw new Error('Desktop capture only accepts a loopback renderer without credentials.');
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BLUE_HERO_CHROMIUM_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === url.origin && ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
    await page.addInitScript(() => {
      const state = {
        appVersion: '0.1.17', platform: 'win32',
        account: { email: 'preview@example.test', plan: 'blue_pro', blueCredits: 0 },
        features: { passwordLoginEnabled: true },
        settings: { provider: 'blue', selectedModel: '', setupCompleted: true, modes: { fullAccess: true, ponytail: false, uiMax: true } },
        projects: [], chats: [], messages: {}, models: [],
        update: { status: 'idle', currentVersion: '0.1.17' },
        ui: { view: 'chat', activeProjectId: null, activeChatId: null, drafts: {}, sidebarOpen: true, rollbackOpen: false, workTraces: {} }
      };
      const subscribe = () => () => {};
      const disabled = async () => { throw new Error('Screenshot preview does not execute tasks.'); };
      window.blueDesktop = {
        bootstrap: async () => state,
        updates: { onEvent: subscribe, check: async () => state.update },
        account: { onEvent: subscribe }, features: { onEvent: subscribe },
        auth: { logout: disabled }, setup: { saveProvider: disabled },
        models: { list: async () => [], select: disabled }, modes: { set: disabled },
        projects: { select: disabled, remove: disabled, reveal: disabled },
        chats: { onEvent: subscribe, create: disabled, send: disabled, stop: disabled, delete: disabled },
        approvals: { reply: disabled }, rollback: { list: async () => [], restore: disabled },
        ui: { save: async () => true },
        connections: { access: disabled, status: disabled, githubStatus: async () => ({ connected: false }) },
        openExternal: disabled, minimize: disabled, toggleMaximize: disabled, close: disabled, isMaximized: async () => false
      };
    });
    await page.goto(url.href, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('Ask Blue anything', { exact: true }).waitFor();
    for (const name of ['File', 'Help', 'Connections', 'Attach file', 'Slash commands', 'Send', 'Set up models']) {
      assert.equal(await page.getByRole('button', { name, exact: true }).count(), 1, `Latest Desktop control missing: ${name}`);
    }
    assert.equal(await page.getByRole('button', { name: 'Edit', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'View', exact: true }).count(), 0);
    assert.equal(await page.getByText('How can Blue help?', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Full Access', { exact: true }).count(), 1);
    assert.equal(await page.getByText('UI Max', { exact: true }).count(), 1);
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(errors, []);
    const output = path.resolve(__dirname, '../public/images/blue-desktop-preview.png');
    await page.screenshot({ path: output, animations: 'disabled' });
    console.log(JSON.stringify({ source: 'Fresh Desktop 0.1.17 renderer', viewport: '1440x900', account: 'Empty offline preview; no real data', output }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
