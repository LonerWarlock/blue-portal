import { NextResponse } from 'next/server';
import { BLUE_RUNTIME_PROTOCOL_VERSION, blueRuntimeCapacityConfig } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const capacity = blueRuntimeCapacityConfig();
  const ready = Boolean(process.env.OPENROUTER_API_KEY && process.env.BLUE_RUNTIME_PROXY_BASE_URL
    && (process.env.BLUE_TASK_TICKET_SECRET || '').length >= 32
    && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  return NextResponse.json({
    version: 'v1',
    runtime_protocol_version: BLUE_RUNTIME_PROTOCOL_VERSION,
    direct_stream_ready: false,
    proxy_stream_ready: ready,
    inference_transport: 'blue-task-ticket',
    primary_proxy_base_url: process.env.BLUE_RUNTIME_PROXY_BASE_URL,
    proxy_fallback_enabled: String(process.env.BLUE_RUNTIME_PROXY_FALLBACK_ENABLED ?? 'true').toLowerCase() !== 'false',
    legacy_stream_proxy_enabled: String(process.env.ENABLE_LEGACY_AI_PROXY || 'false').toLowerCase() === 'true',
    admission: {
      global_concurrency_limit: capacity.globalConcurrency,
      queue_limit: capacity.queueLimit,
      queue_timeout_seconds: capacity.queueTimeoutSeconds,
      heartbeat_interval_seconds: 30
    },
    min_extension_version: '0.6.0',
    maintenance_state: ready ? 'operational' : 'maintenance'
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Pragma': 'no-cache'
    }
  });
}
