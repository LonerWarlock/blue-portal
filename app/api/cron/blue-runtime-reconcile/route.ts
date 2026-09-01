import { NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/cronAuth';
import { publicBlueRuntimeError, reconcileBlueRuntimeTasks } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  try {
    if (!authorizeCron(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
