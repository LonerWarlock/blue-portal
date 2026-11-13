'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { mcpOAuthClientMetadata } = require('./mcpOAuthClientMetadata.cjs');
const client = 'https://blue.imergene.in/api/mcp/client-metadata?port=38128&callback=abcdef123_-A';
test('public metadata identifies Blue and binds one exact loopback callback', () => {
  const metadata = mcpOAuthClientMetadata(client);
  assert.equal(metadata.client_name, 'Blue'); assert.equal(metadata.client_id, client);
  assert.equal(metadata.token_endpoint_auth_method, 'none');
  assert.deepEqual(metadata.redirect_uris, ['http://127.0.0.1:38128/callback/abcdef123_-A']);
  assert.equal(mcpOAuthClientMetadata(client.replace('blue.imergene.in', 'untrusted.example')).client_id, client, 'request Host cannot alter the published app identity');
});
test('metadata rejects arbitrary redirects, extra parameters, invalid ports and duplicate parameters', () => {
  for (const query of ['port=80&callback=abcdef123_-A', 'port=99999&callback=abcdef123_-A', 'port=038128&callback=abcdef123_-A',
    'port=38128&callback=https://evil.example', 'port=38128&callback=abcdef123_-A&port=38129',
    'port=38128&callback=abcdef123_-A&redirect_uri=https://evil.example', 'port=38128']) {
    assert.equal(mcpOAuthClientMetadata('https://blue.imergene.in/api/mcp/client-metadata?' + query), null);
  }
});
test('metadata route has no private-service dependencies and its PNG is under Vercel’s 100 KB limit', () => {
  const route = fs.readFileSync(path.resolve(__dirname, '../app/api/mcp/client-metadata/route.ts'), 'utf8');
  assert.doesNotMatch(route, /supabase|redis|authenticate|process\.env|openrouter/i);
  const icon = fs.readFileSync(path.resolve(__dirname, '../public/images/blue-oauth-icon.png'));
  assert.equal(icon.subarray(1, 4).toString(), 'PNG'); assert.ok(icon.length < 100000);
});
