import { NextResponse } from 'next/server';
import { productionEnvironmentStatus } from '@/lib/envValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8'
};

export async function GET() {
  const readiness = productionEnvironmentStatus();
  return NextResponse.json(
    {
      status: readiness.ready ? 'ok' : 'degraded',
      service: 'blue-portal',
      timestamp: new Date().toISOString()
    },
    { status: readiness.ready ? 200 : 503, headers: HEADERS }
  );
}

export async function HEAD() {
  return new Response(null, {
    status: productionEnvironmentStatus().ready ? 200 : 503,
    headers: HEADERS,
  });
}
