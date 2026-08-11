import { NextResponse } from 'next/server';
import { statusError } from '@/lib/bluePayg';
import { publicBlueRuntimeError, reconcileBlueRuntimeTasks } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  try {
    const configured = String(process.env.CRON_SECRET || '');
    if (!configured || request.headers.get('authorization') !== `Bearer ${configured}`) {
      throw statusError(401, 'Unauthorized');
    }
    const result = await reconcileBlueRuntimeTasks({ limit: 200 });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = Math.max(400, Math.min(599, Number((error as { status?: number })?.status || 500)));
    const message = publicBlueRuntimeError(error, 'Blue runtime reconciliation failed');
    if (status >= 500) console.error('[Blue Runtime] Reconciliation failed:', message);
    return NextResponse.json({ error: message }, { status });
  }
}
