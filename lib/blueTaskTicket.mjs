// Web APIs only: shared by the Portal, Vercel Edge and Cloudflare Workers.
export const TICKET_TTL_SECONDS = 600;
const encoder = new TextEncoder();
const fail = (status, message) => Object.assign(new Error(message), { status });
function encode(value) {
  return btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw fail(401, 'Invalid Blue task ticket.');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}
async function signingKey(secret) {
  if (typeof secret !== 'string' || encoder.encode(secret).length < 32) throw fail(503, 'Blue task signing is not configured.');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export function proxyBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw fail(503, 'Blue proxy endpoint is not configured.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || url.hostname === 'openrouter.ai' || !url.pathname.endsWith('/v1')) throw fail(503, 'Invalid Blue proxy endpoint.');
  return url.href.replace(/\/$/, '');
}
export async function issueTaskTicket(binding, secret, now = Date.now()) {
  const claims = { v: 2, sub: binding.userId, task: binding.taskId, device: binding.deviceHash,
    models: [...new Set(binding.models)], aud: proxyBaseUrl(binding.baseUrl),
    iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + TICKET_TTL_SECONDS, nonce: crypto.randomUUID() };
  const payload = encode(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode('blt2.' + payload));
  return { token: 'blt2.' + payload + '.' + encode(new Uint8Array(signature)), expires_at: new Date(claims.exp * 1000).toISOString() };
}
export async function verifyTaskTicket(token, secret, audience, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 4096) throw fail(401, 'Invalid Blue task ticket.');
  const [prefix, payload, signature, extra] = token.split('.');
  if (prefix !== 'blt2' || !payload || !signature || extra !== undefined) throw fail(401, 'Invalid Blue task ticket.');
  let valid = false;
  try { valid = await crypto.subtle.verify('HMAC', await signingKey(secret), decode(signature), encoder.encode(prefix + '.' + payload)); }
  catch (error) { if (error.status === 503) throw error; }
  if (!valid) throw fail(401, 'Invalid Blue task ticket.');
  let claims;
  try { claims = JSON.parse(new TextDecoder().decode(decode(payload))); } catch { throw fail(401, 'Invalid Blue task ticket.'); }
  const seconds = Math.floor(now / 1000);
  if (claims.v !== 2 || claims.aud !== proxyBaseUrl(audience) || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)
    || claims.iat > seconds + 30 || claims.exp <= seconds || claims.exp - claims.iat > TICKET_TTL_SECONDS
    || !/^[0-9a-f-]{36}$/i.test(claims.sub || '') || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(claims.task || '')
    || !/^[0-9a-f]{64}$/.test(claims.device || '') || !Array.isArray(claims.models) || !claims.models.length || claims.models.length > 2
    || claims.models.some(model => typeof model !== 'string' || model.length > 200 || !model.includes('/'))) {
    throw fail(401, 'Blue task ticket expired or does not match this service.');
  }
  return claims;
}
export async function sha256(value) {
  const hash = await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
