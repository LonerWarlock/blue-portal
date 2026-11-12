import { proxyBaseUrl } from './blueTaskTicket.mjs';

export const VERCEL_PROXY_BASE_URL = 'https://blue-by-imergene.vercel.app/api/runtime/proxy/v1';
const readiness = new Map();
export function isCloudflareProxyBase(value) {
  return value === 'https://models.blue.imergene.in/v1'
    || /^https:\/\/blue-inference-proxy\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.workers\.dev\/v1$/.test(value);
}
export function configuredProxyBase(env) {
  const base = proxyBaseUrl(env.BLUE_RUNTIME_PROXY_BASE_URL);
  if (!isCloudflareProxyBase(base) && base !== VERCEL_PROXY_BASE_URL) throw new Error('Configure the Blue Cloudflare Worker URL or the approved Vercel fallback.');
  return base;
}

/** Probe before issuing a ticket, never replay a model POST on another host. */
export async function selectProxyBase(env, fetcher = fetch) {
  const primary = configuredProxyBase(env);
  if (primary === VERCEL_PROXY_BASE_URL) return primary;
  let entry = readiness.get(primary);
  if (!entry || entry.until <= Date.now()) {
    entry = { until: Date.now() + 15000, pending: (async () => {
      try {
        const result = await fetcher(primary + '/health', { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(2500) });
        if (!result.ok) return false;
        const value = await result.json();
        return value.runtime_protocol_version === 2 && value.proxy_stream_ready === true && value.inference_transport === 'blue-task-ticket';
      } catch { return false; }
    })() };
    readiness.clear(); readiness.set(primary, entry);
  }
  if (await entry.pending) return primary;
  if (String(env.BLUE_RUNTIME_PROXY_FALLBACK_ENABLED ?? 'true').toLowerCase() !== 'false') return VERCEL_PROXY_BASE_URL;
  throw Object.assign(new Error('Blue’s streaming proxy is temporarily unavailable. No model request was sent.'), { status: 503 });
}
