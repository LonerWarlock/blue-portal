import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBluePaygAccount, statusError } from '@/lib/bluePayg';
import { getOpenRouterModels, modelsForAccess, publicModel } from '@/lib/openrouter';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('catalog') === 'public') {
      const models = modelsForAccess(await getOpenRouterModels(), 'full')
        .map(publicModel)
        .sort((left, right) => left.displayName.localeCompare(right.displayName));
      return NextResponse.json({ models, access_tier: 'catalog' });
    }

    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) throw statusError(401, 'Unauthorized: Missing token');
    const token = authorization.slice(7).trim();
    if (!token) throw statusError(401, 'Unauthorized: Empty token');

    const account = token.startsWith('blue_')
      ? await authenticateBlueKey(token)
      : await accountFromSession(token);
    const models = modelsForAccess(await getOpenRouterModels(), account.accessTier)
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
