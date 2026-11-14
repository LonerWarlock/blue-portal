import { handleBlueProxy } from '../lib/blueInferenceProxy.mjs';
import { isCloudflareProxyBase } from '../lib/blueProxyEndpoints.mjs';

export const requiredSecrets = ['BLUE_TASK_TICKET_SECRET', 'OPENROUTER_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];

export default {
  fetch(request, env, context) {
    const url = new URL(request.url);
    const base = url.origin + '/v1';
    // The Worker derives its own audience from its assigned HTTPS hostname.
    // Never trust forwarding headers or an incoming provider URL.
    if (!isCloudflareProxyBase(base)) return new Response('Unknown Blue proxy hostname', { status: 404 });
    if (request.method === 'GET' && url.pathname === '/v1/health' && !url.search) {
      const ready = requiredSecrets.every(name => Boolean(env[name])) && env.BLUE_TASK_TICKET_SECRET.length >= 32;
      return Response.json({ runtime_protocol_version: 2, inference_transport: 'blue-task-ticket',
        proxy_stream_ready: ready, execution: 'cloudflare-worker', admission_mode: env.BLUE_PROXY_ATOMIC_ADMISSION || 'auto', admission_protocol_version: 2 }, {
        status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' }
      });
    }
    return handleBlueProxy(request, { env: { ...env, BLUE_RUNTIME_PROXY_BASE_URL: base }, waitUntil: work => context.waitUntil(work) });
  }
};
