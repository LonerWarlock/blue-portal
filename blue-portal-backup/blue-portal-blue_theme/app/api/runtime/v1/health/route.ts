import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: 'v1',
    direct_stream_ready: true,
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
