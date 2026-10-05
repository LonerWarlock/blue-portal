import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import {
  BLUE_DESKTOP_STORE_ID,
  BLUE_DESKTOP_STORE_URL,
  BLUE_DESKTOP_STORE_URI,
  BLUE_DESKTOP_INSTALLER_URL,
  getBlueDesktopLink,
  isWindowsDesktop,
} from './desktop-download.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const windows = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };

test('Windows client hints choose the direct installer or native Store listing', () => {
  for (const platform of ['Windows', ' windows ', 'WINDOWS']) {
    const browser = { userAgentData: { platform } };
    assert.equal(isWindowsDesktop(browser), true);
    assert.equal(getBlueDesktopLink('download', browser), BLUE_DESKTOP_INSTALLER_URL);
    assert.equal(getBlueDesktopLink('store', browser), BLUE_DESKTOP_STORE_URI);
  }
});

test('Windows UA and legacy navigator.platform both work without client hints', () => {
  for (const browser of [windows, { platform: 'Win32' }, { platform: 'Win64' }, { platform: 'win32' }, { ...windows, userAgentData: { platform: ' ' } }]) {
    assert.equal(isWindowsDesktop(browser), true);
    assert.equal(getBlueDesktopLink('download', browser), BLUE_DESKTOP_INSTALLER_URL);
    assert.equal(getBlueDesktopLink('store', browser), BLUE_DESKTOP_STORE_URI);
  }
});

test('non-Windows client hints are authoritative despite a Windows-looking UA', () => {
  for (const platform of ['macOS', 'Linux', 'Android', 'iOS', 'Chrome OS']) {
    const browser = { ...windows, platform: 'Win32', userAgentData: { platform } };
    assert.equal(isWindowsDesktop(browser), false);
    assert.equal(getBlueDesktopLink('download', browser), BLUE_DESKTOP_STORE_URL);
    assert.equal(getBlueDesktopLink('store', browser), BLUE_DESKTOP_STORE_URL);
  }
});

test('mobile and non-Windows UA/platform visitors retain a usable web listing', () => {
  for (const browser of [
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel' },
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Win32' },
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', platform: 'Win32' },
    { userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0)', platform: 'Win32' },
    { userAgent: 'Mozilla/5.0 (iPod; CPU OS 18_0)', platform: 'Win32' },
    { userAgent: 'Mozilla/5.0 (Windows Phone 10.0; Windows NT 10.0)', platform: 'Win32' },
  ]) {
    assert.equal(isWindowsDesktop(browser), false);
    assert.equal(getBlueDesktopLink('download', browser), BLUE_DESKTOP_STORE_URL);
    assert.equal(getBlueDesktopLink('store', browser), BLUE_DESKTOP_STORE_URL);
  }
});

test('SSR and missing browser platform information safely use the web listing', () => {
  for (const browser of [undefined, {}, { userAgent: '', platform: '' }]) {
    assert.equal(isWindowsDesktop(browser), false);
    assert.equal(getBlueDesktopLink('download', browser), BLUE_DESKTOP_STORE_URL);
    assert.equal(getBlueDesktopLink('store', browser), BLUE_DESKTOP_STORE_URL);
  }
});

test('the installer lowercases and encodes the source hostname without injecting query parameters', () => {
  const hostname = 'BLUE.example&campaign=other/with space';
  const href = getBlueDesktopLink('download', windows, hostname);
  assert.equal(href, `${BLUE_DESKTOP_INSTALLER_URL}&source=${encodeURIComponent(hostname.toLowerCase())}`);
  const url = new URL(href);
  assert.deepEqual([...url.searchParams.entries()], [['referrer', 'appbadge'], ['source', hostname.toLowerCase()]]);
  assert.equal(getBlueDesktopLink('download', windows, ''), BLUE_DESKTOP_INSTALLER_URL);
  assert.equal(getBlueDesktopLink('store', windows, hostname), BLUE_DESKTOP_STORE_URI);
  assert.equal(getBlueDesktopLink('download', {}, hostname), BLUE_DESKTOP_STORE_URL);
});

test('all destinations use the stable Microsoft product ID rather than a fixed release version', () => {
  assert.equal(BLUE_DESKTOP_STORE_ID, '9NHV6GFJ64C8');
  assert.equal(BLUE_DESKTOP_STORE_URL, 'https://apps.microsoft.com/detail/9NHV6GFJ64C8');
  assert.equal(BLUE_DESKTOP_STORE_URI, 'ms-windows-store://pdp/?ProductId=9NHV6GFJ64C8');
  assert.equal(BLUE_DESKTOP_INSTALLER_URL, 'https://get.microsoft.com/installer/download/9NHV6GFJ64C8?referrer=appbadge');
  for (const href of [BLUE_DESKTOP_STORE_URL, BLUE_DESKTOP_STORE_URI, BLUE_DESKTOP_INSTALLER_URL]) {
    assert.ok(href.includes(BLUE_DESKTOP_STORE_ID));
    assert.doesNotMatch(href, /\d+\.\d+\.\d+/);
    assert.equal(new URL(href).searchParams.has('version'), false);
  }
});

// Execute only this component's JSX and React hooks in isolation. No browser,
// rendering engine, network requests, account state, or external navigation.
function makeLink({ browser, hostname = 'Blue.Example', ssr = false } = {}) {
  let state;
  let mounted = false;
  let queuedEffect;
  const source = readFileSync(new URL('../app/components/DesktopDownloadLink.tsx', import.meta.url), 'utf8');
  const transformed = ts.transpileModule(source, {
    fileName: 'DesktopDownloadLink.tsx',
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.equal(transformed.diagnostics.length, 0);
  const module = { exports: {} };
  const imports = {
    react: {
      useState(initial) { if (!mounted) state = initial; return [state, next => { state = next; }]; },
      useEffect(effect) { if (!mounted) queuedEffect = effect; },
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '@/lib/desktop-download': { BLUE_DESKTOP_STORE_URL, getBlueDesktopLink },
  };
  const globals = ssr ? {} : { navigator: browser, window: { location: { hostname } } };
  vm.runInNewContext(transformed.outputText, {
    module, exports: module.exports, ...globals,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected component import: ${name}`); return imports[name]; },
  }, { filename: 'DesktopDownloadLink.tsx' });
  return {
    render(props = {}) { const tree = module.exports.default(props); mounted = true; return tree; },
    effect() { assert.equal(typeof queuedEffect, 'function'); queuedEffect(); },
  };
}

function clickEvent(initial = {}) {
  return { defaultPrevented: false, currentTarget: { ...initial }, preventDefault() { this.defaultPrevented = true; } };
}

test('the component first render is server-safe and keeps public web-link security attributes', () => {
  const { props, type } = makeLink({ ssr: true }).render({ children: 'Download Blue Desktop', id: 'desktop-download' });
  assert.equal(type, 'a');
  assert.equal(props.href, BLUE_DESKTOP_STORE_URL);
  assert.equal(props.target, '_blank');
  assert.equal(props.rel, 'noopener noreferrer');
  assert.equal(props.children, 'Download Blue Desktop');
  assert.equal(props.id, 'desktop-download');
  assert.equal(props['data-blue-desktop-link'], 'download');
});

test('a Windows click before effects navigates directly in the same user gesture', () => {
  for (const variant of ['download', 'store']) {
    const tree = makeLink({ browser: windows }).render({ variant });
    assert.equal(tree.props.href, BLUE_DESKTOP_STORE_URL);
    const event = clickEvent({ href: BLUE_DESKTOP_STORE_URL, target: '_blank', rel: 'noopener noreferrer' });
    tree.props.onClick(event);
    assert.equal(event.currentTarget.href, getBlueDesktopLink(variant, windows, 'Blue.Example'));
    assert.equal(event.currentTarget.target, '_self');
    assert.equal(event.currentTarget.rel, '');
    assert.equal(event.defaultPrevented, false);
  }
});

test('the mounted link exposes the direct Windows installer or Store protocol', () => {
  for (const variant of ['download', 'store']) {
    const link = makeLink({ browser: windows });
    link.render({ variant });
    link.effect();
    const { props } = link.render({ variant });
    assert.equal(props.href, getBlueDesktopLink(variant, windows, 'Blue.Example'));
    assert.equal(props.target, undefined);
    assert.equal(props.rel, undefined);
  }
});

test('non-Windows component clicks and effects retain the secure web fallback', () => {
  const browser = { userAgentData: { platform: 'macOS' } };
  for (const variant of ['download', 'store']) {
    const link = makeLink({ browser });
    const tree = link.render({ variant });
    const event = clickEvent();
    tree.props.onClick(event);
    assert.equal(event.currentTarget.href, BLUE_DESKTOP_STORE_URL);
    assert.equal(event.currentTarget.target, '_blank');
    assert.equal(event.currentTarget.rel, 'noopener noreferrer');
    link.effect();
    assert.equal(link.render({ variant }).props.href, BLUE_DESKTOP_STORE_URL);
  }
});

test('caller cancellation prevents destination mutations and preserves caller props', () => {
  const initial = { href: 'https://example.invalid/original', target: '_blank', rel: 'original' };
  const event = clickEvent(initial);
  let received;
  const { props } = makeLink({ browser: windows }).render({
    className: 'caller-class', title: 'Caller title', 'aria-label': 'Install Blue',
    onClick(value) { received = value; value.preventDefault(); },
  });
  props.onClick(event);
  assert.equal(received, event);
  assert.deepEqual(event.currentTarget, initial);
  assert.equal(props.className, 'caller-class');
  assert.equal(props.title, 'Caller title');
  assert.equal(props['aria-label'], 'Install Blue');
});

test('mobile-menu onClick forwarding happens before updating the anchor without cancelling navigation', () => {
  const event = clickEvent({ href: BLUE_DESKTOP_STORE_URL });
  let menuOpen = true;
  const { props } = makeLink({ browser: windows }).render({
    onClick(value) { assert.equal(value.currentTarget.href, BLUE_DESKTOP_STORE_URL); menuOpen = false; },
  });
  props.onClick(event);
  assert.equal(menuOpen, false);
  assert.equal(event.defaultPrevented, false);
  assert.equal(event.currentTarget.href, getBlueDesktopLink('download', windows, 'Blue.Example'));
});
