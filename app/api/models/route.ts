import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBluePaygAccount, statusError } from '@/lib/bluePayg';
import { getOpenRouterModels, modelsForAccess, publicModel } from '@/lib/openrouter';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { blockedRuntimeModels, reconcileBlueRuntimeTasks } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('catalog') === 'public') {
      const blocked = await blockedRuntimeModels();
      const models = modelsForAccess(await getOpenRouterModels(), 'full')
        .filter(model => !blocked.has(model.id))
        .map(publicModel)
        .sort((left, right) => left.displayName.localeCompare(right.displayName));
      return NextResponse.json({ models, access_tier: 'catalog' });
    }

    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) throw statusError(401, 'Unauthorized: Missing token');
    const token = authorization.slice(7).trim();
    if (!token) throw statusError(401, 'Unauthorized: Empty token');

    let account = token.startsWith('blue_')
      ? await authenticateBlueKey(token)
      : await accountFromSession(token);
    await reconcileBlueRuntimeTasks({ userId: account.userId, limit: 20 });
    account = await getBluePaygAccount(account.userId);
    const blocked = await blockedRuntimeModels();
    const models = modelsForAccess(await getOpenRouterModels(), account.accessTier)
      .filter(model => !blocked.has(model.id))
      .map(publicModel)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));

    return NextResponse.json({
      models,
      access_tier: account.accessTier,
      blue_credits: account.balance,
      low_balance_threshold: account.threshold
    });
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    const message = error instanceof Error ? error.message : 'Failed to load the model catalog';
    console.error('[Blue PAYG] Models request failed:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

async function accountFromSession(token: string) {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw statusError(401, 'Unauthorized: Invalid session token');
  return getBluePaygAccount(data.user.id);
}
