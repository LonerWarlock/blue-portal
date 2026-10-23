'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const ts = require('typescript');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let esbuild;
try { esbuild = require(require.resolve('esbuild', { paths: [root, path.resolve(root, '../BlueV2/desktop')] })); } catch {}
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

test('real Teams page renders verified plan and pending preference in an isolated browser', {
  skip: !esbuild || !fs.existsSync(edge), timeout: 90000,
}, async () => {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const configModule = { exports: {} };
  vm.runInNewContext(compiled.outputText, { exports: configModule.exports, module: configModule });
  const config = configModule.exports.default;
  config.content = config.content.map(glob => path.resolve(root, glob).replaceAll('\\', '/'));
  const globalCss = await postcss([tailwind(config)]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') });
  const bundle = await esbuild.build({
    absWorkingDir: root,
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import TeamsClient from './app/teams/TeamsClient';
      createRoot(document.getElementById('root')).render(<TeamsClient checkout={{checkoutEnabled:true,testMode:false,liveTestPriceEnabled:false,payuAvailable:true,paypalAvailable:true}}/>);`, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, outfile: 'fixture.js', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'isolated-navigation-and-account-only', setup(build) {
      build.onResolve({ filter: /^(?:next\/(?:link|image|navigation))$/ }, args => ({ path: args.path, namespace: 'synthetic-only' }));
      build.onResolve({ filter: /(?:^|\/)contexts\/(?:AuthContext|ThemeContext|CookieConsentContext)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'synthetic-only' }));
      build.onLoad({ filter: /.*/, namespace: 'synthetic-only' }, args => ({ loader: 'tsx', resolveDir: root, contents:
        args.path === 'next/link' ? `import React from 'react';export default function Link({children,prefetch,...props}){return <a {...props}>{children}</a>}` :
        args.path === 'next/image' ? `import React from 'react';export default function Image({unoptimized,priority,...props}){return <img {...props}/ >}` :
        args.path === 'next/navigation' ? `export const usePathname=()=>'/teams';export const useRouter=()=>({push(){throw Error('No navigation permitted in QA')}});` :
        args.path === 'ThemeContext' ? `export function useTheme(){return {theme:'light',resolvedTheme:'light',setTheme(){}}}` :
        args.path === 'CookieConsentContext' ? `export function useCookieConsent(){return {resetConsent(){}}}` :
        `import{useSyncExternalStore}from'react';const listeners=new Set();window.__setAuth=patch=>{window.__auth={...window.__auth,...patch};listeners.forEach(fn=>fn())};export function useAuth(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>window.__auth,()=>window.__auth)}`,
      }));
    } }],
  });
  const javascript = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = globalCss.css + '\n' + bundle.outputFiles.find(file => file.path.endsWith('.css')).text + `
    :root{--font-inter:Arial;--font-plex-sans:Arial;--font-plex-mono:monospace}
    body{margin:0;background:var(--paper);font-family:Arial,Helvetica,sans-serif}
    #plans::before{content:'ISOLATED UI CHECK · Synthetic account · No real auth or payment';display:block;margin:0 0 16px;padding:8px 12px;border:1px dashed var(--line-strong);color:var(--ink-muted);font-size:10px}
  `;
  const html = '<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
  const server = http.createServer((request, response) => {
    if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(javascript); }
    else if (request.url === '/fixture.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); }
    else if (request.url === '/images/blue-symbol.png') { response.setHeader('Content-Type', 'image/png'); response.end(fs.readFileSync(path.join(root, 'public/images/blue-symbol.png'))); }
    else if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); }
    else { response.statusCode = request.url === '/favicon.ico' ? 204 : 404; response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const artifacts = path.join(root, 'test-results/teams-plan-browser');
  fs.mkdirSync(artifacts, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ executablePath: edge, headless: true, args: ['--disable-background-networking'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', timezoneId: 'Asia/Kolkata', locale: 'en-IN' });
    const external = [], errors = [];
    await context.route('**/*', route => { if (new URL(route.request().url()).origin === origin) return route.continue(); external.push(route.request().url()); return route.abort(); });
    await context.addInitScript(() => {
      window.__fetchAttempts = [];
      window.fetch = async (...args) => { window.__fetchAttempts.push(args[0]); throw new Error('Network disabled in isolated UI check'); };
      const expires = '2026-11-22T12:00:00.000Z';
      window.__auth = { user: { id: 'synthetic-pro-member', email: 'synthetic@example.invalid' }, session: { access_token: 'synthetic-not-a-real-token' }, loading: false, accountLoading: false, accountError: '',
        account: { user_id: 'synthetic-pro-member', wallet: { balance: 0 }, subscription: { plan: 'blue_pro', is_pro: true }, teams: { available: true, plan: 'pro', status: 'active', current_period_end: expires, active_project_teams: 3, agents_per_team: 5, scheduled_change: { plan: 'solo', change_at: expires, payment_required: true } } },
        invalidateAccount: async () => null,
      };
    });
    const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-23T12:00:00.000Z') });
    await page.goto(origin);
    await page.getByRole('region', { name: 'Your active Blue Teams plan' }).getByText('Teams Pro is active', { exact: true }).waitFor();
    const plans = page.locator('#plans');
    await plans.getByText('3 active project teams · Up to 5 agents per team.', { exact: true }).waitFor();
    await plans.getByText('Teams Solo is scheduled', { exact: true }).waitFor();
    await plans.getByRole('button', { name: 'Renew Pro', exact: true }).waitFor();
    await plans.getByRole('button', { name: 'Upgrade to Business', exact: true }).waitFor();
    await plans.getByRole('button', { name: 'Change to Solo at expiry', exact: true }).waitFor();
    assert.equal(await plans.getByText('Current plan', { exact: true }).count(), 1);
    await plans.screenshot({ path: path.join(artifacts, 'teams-pro-active-and-pending.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await plans.screenshot({ path: path.join(artifacts, 'teams-pro-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.evaluate(() => {
      window.__setAuth({ account: { ...window.__auth.account, teams: { available: true, plan: null, status: 'inactive', current_period_end: null, active_project_teams: 0, agents_per_team: 0,
        scheduled_change: { plan: 'solo', change_at: '2026-10-22T12:00:00.000Z', payment_required: true } } } });
    });
    await plans.getByText('Chosen next plan: Teams Solo — payment required', { exact: true }).waitFor();
    await plans.getByRole('button', { name: 'Complete Solo checkout', exact: true }).waitFor();
    assert.equal(await plans.getByText('Current plan', { exact: true }).count(), 0);
    await plans.screenshot({ path: path.join(artifacts, 'teams-expired-preference.png') });
    assert.deepEqual(await page.evaluate(() => window.__fetchAttempts), []);
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    console.log(`UI proof saved in ${artifacts}`);
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
