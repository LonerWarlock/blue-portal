#!/usr/bin/env node
'use strict';

// Local regression fixture: fail the real production root-layout chunk, not
// an optional SDK. Fixed loopback upstream; never forward account credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const HOST = '127.0.0.1';
const STATUS_PATH = '/__chunk_test__/status';
const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade']);

function discoverLayoutChunk(buildRoot = path.resolve(__dirname, '../.next')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(buildRoot, 'app-build-manifest.json'), 'utf8'));
  const chunks = manifest.pages?.['/layout']?.filter(file => /^static\/chunks\/app\/layout-[a-f0-9]+\.js$/.test(file));
  assert.equal(chunks?.length, 1, 'Build must contain one root-layout JavaScript chunk.');
  return `/_next/${chunks[0]}`;
}

function headersWithoutCredentials(headers, request = false) {
  const connections = String(headers.connection || '').toLowerCase().split(',').map(value => value.trim());
  return Object.fromEntries(Object.entries(headers).filter(([key]) => {
    const name = key.toLowerCase();
    return !HOP.has(name) && !connections.includes(name)
      && !(request && (['authorization', 'cookie', 'accept-encoding', 'forwarded'].includes(name) || name.startsWith('x-forwarded-')))
      && !(!request && name === 'set-cookie');
  }));
}

function createFixture({ port = 3320, upstreamPort = 3319, failures = 1, chunkPath = discoverLayoutChunk() } = {}) {
  assert.ok(failures === 'always' || [0, 1, 2].includes(failures));
  assert.match(chunkPath, /^\/_next\/static\/chunks\/app\/layout-[a-f0-9]+\.js$/);
  const requests = [];
  let failed = 0;
  const server = http.createServer((request, response) => {
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) {
      response.writeHead(400); response.end('Only local application paths are supported.'); return;
    }
    const pathname = new URL(request.url, `http://${HOST}:${port}`).pathname;
    if (pathname === STATUS_PATH) {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ chunkPath, failures, failed, requests })); return;
    }
    if (pathname === chunkPath) {
      const fail = failures === 'always' || failed < failures;
      requests.push({ attempt: requests.length + 1, failed: fail });
      if (fail) {
        failed += 1;
        response.writeHead(503, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
        response.end('/* Deliberate required layout chunk failure, local test only. */'); return;
      }
    }
    const headers = headersWithoutCredentials(request.headers, true);
    headers.host = `${HOST}:${upstreamPort}`;
    const upstream = http.request({ hostname: HOST, port: upstreamPort, path: request.url,
      method: request.method, headers }, incoming => {
      response.writeHead(incoming.statusCode || 502, {
        ...headersWithoutCredentials(incoming.headers), 'cache-control': 'no-store',
      });
      incoming.on('error', () => response.destroy());
      incoming.pipe(response);
    });
    upstream.on('error', () => {
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(502, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      response.end('Local Next test server unavailable.');
    });
    request.on('aborted', () => upstream.destroy());
    response.on('close', () => { if (!response.writableEnded) upstream.destroy(); });
    request.pipe(upstream);
  });
  server.on('connect', (_request, socket) => socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n'));
  return server;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = { port: 3320, upstreamPort: 3319, failures: 1 };
  for (let index = 0; index < args.length; index += 2) {
    const name = { '--port': 'port', '--upstream-port': 'upstreamPort', '--failures': 'failures' }[args[index]];
    assert.ok(name, 'Only --port, --upstream-port and --failures are supported.');
    const value = args[index + 1];
    if (name === 'failures' && value === 'always') options[name] = value;
    else {
      assert.match(value || '', /^\d+$/);
      options[name] = Number(value);
      assert.ok(Number.isSafeInteger(options[name]));
      if (name !== 'failures') assert.ok(options[name] > 0 && options[name] <= 65535);
    }
  }
  assert.notEqual(options.port, options.upstreamPort);
  createFixture(options).listen(options.port, HOST, () => {
    console.log(`Required-chunk failure fixture: http://${HOST}:${options.port} (${options.failures} failures)`);
  });
}

module.exports = { discoverLayoutChunk, createFixture };
