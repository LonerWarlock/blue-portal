import { NextResponse } from 'next/server';
import { BLUE_RUNTIME_PROTOCOL_VERSION, blueRuntimeCapacityConfig } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const capacity = blueRuntimeCapacityConfig();
  return NextResponse.json({
    version: 'v1',
    runtime_protocol_version: BLUE_RUNTIME_PROTOCOL_VERSION,
    direct_stream_ready: true,
    legacy_stream_proxy_enabled: String(process.env.ENABLE_LEGACY_AI_PROXY || 'false').toLowerCase() === 'true',
    admission: {
      global_concurrency_limit: capacity.globalConcurrency,
      queue_limit: capacity.queueLimit,
      queue_timeout_seconds: capacity.queueTimeoutSeconds,
      heartbeat_interval_seconds: 30
    },
    min_extension_version: '0.6.0',
    maintenance_state: 'operational'
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Pragma': 'no-cache'
    }
  });
}
