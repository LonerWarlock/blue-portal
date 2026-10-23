#!/usr/bin/env node
'use strict';

// LOCAL TEST FIXTURE ONLY. This deliberately fails the optional PostHog SDK
// request so the public website can be checked with a real browser. It is not
// imported by the application and must never be deployed as a production proxy.
// Build first, run Next on 127.0.0.1:3305, then run this script and visit :3306.
// Startup also checks that public initial bundles do not require the deferred
// auth SDK or Framer runtime. Only analytics requests are deliberately failed:
// this fixture does not claim to survive missing React/Next/application chunks
// or diagnose why Google's renderer sometimes fails to fetch a required asset.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORTAL_ROOT = path.resolve(__dirname, '..');
const BUILD_ROOT = path.join(PORTAL_ROOT, '.next');
const ROUTES = ['/teams/page', '/guides/ai-agent-teams/page'];
const STATUS_PATH = '/__analytics_test__/status';
const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

function discoverSdkChunks(buildRoot = BUILD_ROOT) {
  const loadable = JSON.parse(fs.readFileSync(path.join(buildRoot, 'react-loadable-manifest.json'), 'utf8'));
  const app = JSON.parse(fs.readFileSync(path.join(buildRoot, 'app-build-manifest.json'), 'utf8'));
  // The dynamic-import manifest identifies the SDK rather than our small safe
  // adapter, which also mentions PostHog method names in its source.
  const sdkFiles = [...new Set(Object.entries(loadable)
    .filter(([name]) => / -> posthog-js$/.test(name))
    .flatMap(([, entry]) => entry.files || [])
    .filter(file => file.endsWith('.js')))];
  assert.ok(sdkFiles.length, 'No dynamic posthog-js SDK chunk found. Complete the production build first.');
  const authFiles = [...new Set(Object.entries(loadable)
    .filter(([name]) => name.endsWith(' -> @/lib/supabase'))
    .flatMap(([, entry]) => entry.files || [])
    .filter(file => file.endsWith('.js')))];
  assert.ok(authFiles.length, 'No deferred Supabase module found. Complete the production build first.');

  const sources = new Map();
  function readChunk(file) {
    assert.match(file, /^static\/chunks\//, 'Only built static JavaScript chunks may be inspected.');
    const absolute = path.resolve(buildRoot, file);
    assert.ok(absolute.startsWith(`${path.resolve(buildRoot)}${path.sep}`), 'Chunk escaped the build folder.');
    if (!sources.has(file)) sources.set(file, fs.readFileSync(absolute, 'utf8'));
    return sources.get(file);
  }

  for (const file of sdkFiles) {
    const source = readChunk(file);
    assert.ok(/posthog/i.test(source) && source.includes('opt_out_capturing')
      && source.includes('disable_session_recording') && source.includes('get_distinct_id'),
    `Manifest entry is not a recognizable PostHog SDK implementation: ${file}`);
  }
  // Supabase's manifest includes its own adapter chunk plus vendor chunks.
  // Do not apply PostHog's implementation markers or blocking behavior to them.
  for (const file of authFiles) readChunk(file);

  assert.ok(Array.isArray(app.pages?.['/layout']), 'Root layout build entry is missing.');
  for (const route of ROUTES) {
    assert.ok(Array.isArray(app.pages?.[route]), `Route build entry is missing: ${route}`);
    const required = new Set([...app.pages['/layout'], ...app.pages[route]]);
    for (const file of sdkFiles) {
      assert.equal(required.has(file), false, `Optional analytics is still required by the initial ${route} bundle: ${file}`);
    }
    for (const file of authFiles) {
      assert.equal(required.has(file), false, `Deferred auth SDK is still required by the initial ${route} bundle: ${file}`);
    }
    for (const file of required) {
      if (!file.endsWith('.js')) continue;
      const source = readChunk(file);
      // Distinct implementation markers in the installed Framer/Motion
      // runtime, not incidental page text or CSS animation class names.
      const hasFramerRuntime = source.includes('motionComponentSymbol')
        || (source.includes('visualElement') && source.includes('onViewportEnter') && source.includes('layoutScroll'));
      assert.equal(hasFramerRuntime, false, `Framer runtime is still required by the initial ${route} bundle: ${file}`);
    }
  }
  return sdkFiles.map(file => `/_next/${file}`);
}

function readPorts(argv) {
  const options = { port: 3306, upstreamPort: 3305 };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index] === '--port' ? 'port'
      : argv[index] === '--upstream-port' ? 'upstreamPort' : null;
    assert.ok(key, 'Only --port and --upstream-port are supported; the upstream host is always 127.0.0.1.');
    const value = argv[index + 1];
    assert.ok(/^\d+$/.test(value || ''), `${argv[index]} requires a numeric port.`);
    const port = Number(value);
    assert.ok(Number.isSafeInteger(port) && port > 0 && port <= 65535, 'Port must be between 1 and 65535.');
    options[key] = port;
  }
  assert.notEqual(options.port, options.upstreamPort, 'Fixture and upstream ports must differ.');
  return options;
}

function filteredHeaders(headers, request = false) {
  const connectionNames = new Set(String(headers.connection || '').toLowerCase().split(',').map(name => name.trim()));
  const filtered = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || connectionNames.has(lower)) continue;
    // Do not forward credentials or inherited proxy headers to the local app.
    if (request && (['authorization', 'cookie', 'accept-encoding'].includes(lower)
      || lower.startsWith('x-forwarded-') || lower === 'forwarded')) continue;
    if (!request && lower === 'set-cookie') continue;
    filtered[lower] = value;
  }
  return filtered;
}

function createFixture({ port = 3306, upstreamPort = 3305, sdkChunks = discoverSdkChunks() } = {}) {
  const sdkPaths = new Set(sdkChunks);
  const blockedRequests = [];
  const allSdkRequests = [];
  const server = http.createServer((request, response) => {
    // Reject absolute-form/proxy requests; this fixture has one fixed loopback
    // upstream and is not an external browsing or arbitrary URL proxy.
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('Only local application paths are supported.');
      return;
    }
    const pathname = new URL(request.url, `http://${HOST}:${port}`).pathname;
    if (pathname === STATUS_PATH) {
      const body = JSON.stringify({ blockedRequests, sdkChunks: [...sdkPaths], allSdkRequests });
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store',
      });
      response.end(body);
      return;
    }
    if (sdkPaths.has(pathname)) {
      // Log pathnames only: never request bodies, query strings, or credentials.
      allSdkRequests.push(pathname);
      blockedRequests.push(pathname);
      response.writeHead(503, {
        'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store',
      });
      response.end('/* Deliberate optional analytics SDK failure in the local test fixture. */');
      return;
    }

    const headers = filteredHeaders(request.headers, true);
    headers.host = `${HOST}:${upstreamPort}`;
    const upstream = http.request({
      hostname: HOST, port: upstreamPort, method: request.method,
      path: request.url, headers,
    }, upstreamResponse => {
      const responseHeaders = filteredHeaders(upstreamResponse.headers);
      responseHeaders['cache-control'] = 'no-store';
      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.on('error', () => response.destroy());
      upstreamResponse.pipe(response);
    });
    upstream.on('error', () => {
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('The local Next test server is unavailable.');
    });
    request.on('aborted', () => upstream.destroy());
    response.on('close', () => { if (!response.writableEnded) upstream.destroy(); });
    request.pipe(upstream);
  });
  server.on('connect', (_request, socket) => socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n'));
  return server;
}

if (require.main === module) {
  const options = readPorts(process.argv.slice(2));
  const sdkChunks = discoverSdkChunks();
  const server = createFixture({ ...options, sdkChunks });
  server.listen(options.port, HOST, () => {
    console.log(`Analytics failure fixture ready: http://${HOST}:${options.port}`);
    for (const chunk of sdkChunks) console.log(chunk);
  });
}

module.exports = { discoverSdkChunks, readPorts, createFixture };
