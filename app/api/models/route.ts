import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { authenticateBlueKey, getBluePaygAccount, statusError } from '@/lib/bluePayg';
import { getOpenRouterModels, modelsForAccess, publicModel } from '@/lib/openrouter';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { blockedRuntimeModels } from '@/lib/blueRuntime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_CATALOG_TTL_MS = 5 * 60 * 1000;
const PUBLIC_CATALOG_STALE_MS = 24 * 60 * 60 * 1000;
const PUBLIC_CATALOG_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
};

type PublicCatalog = {
  models: ReturnType<typeof publicModel>[];
  access_tier: 'catalog';
};

let publicCatalogFallback: { loadedAt: number; payload: PublicCatalog } | undefined;
let publicCatalogRequest: Promise<PublicCatalog> | undefined;

const getSharedPublicCatalog = unstable_cache(
  async (): Promise<PublicCatalog> => {
    const blocked = await blockedRuntimeModels();
    const models = modelsForAccess(await getOpenRouterModels(), 'full')
      .filter(model => !blocked.has(model.id))
      .map(publicModel)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
    return { models, access_tier: 'catalog' };
  },
  ['blue-public-model-catalog-v2'],
  { revalidate: 300, tags: ['blue-public-model-catalog'] }
);

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('catalog') === 'public') {
      return NextResponse.json(await publicModelCatalog(), { headers: PUBLIC_CATALOG_HEADERS });
    }

    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) throw statusError(401, 'Unauthorized: Missing token');
    const token = authorization.slice(7).trim();
    if (!token) throw statusError(401, 'Unauthorized: Empty token');

    const account = token.startsWith('blue_')
      ? await authenticateBlueKey(token)
      : await accountFromSession(token);
    const blocked = await blockedRuntimeModels();
    const models = modelsForAccess(await getOpenRouterModels(), account.accessTier)
      .filter(model => !blocked.has(model.id))
      .map(publicModel)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));

    return NextResponse.json(
      {
        models,
        access_tier: account.accessTier,
        blue_credits: account.balance,
        low_balance_threshold: account.threshold
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    const message = error instanceof Error ? error.message : 'Failed to load the model catalog';
    console.error('[Blue PAYG] Models request failed:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

async function publicModelCatalog(): Promise<PublicCatalog> {
  const now = Date.now();
  if (publicCatalogFallback && now - publicCatalogFallback.loadedAt < PUBLIC_CATALOG_TTL_MS) {
    return publicCatalogFallback.payload;
  }
  if (publicCatalogRequest) return publicCatalogRequest;

  publicCatalogRequest = (async () => {
    try {
      const payload = await getSharedPublicCatalog();
      publicCatalogFallback = { loadedAt: Date.now(), payload };
      return payload;
    } catch (error) {
      if (publicCatalogFallback && now - publicCatalogFallback.loadedAt < PUBLIC_CATALOG_STALE_MS) {
        return publicCatalogFallback.payload;
      }
      throw error;
    }
  })();

  try {
    return await publicCatalogRequest;
  } finally {
    publicCatalogRequest = undefined;
  }
}

async function accountFromSession(token: string) {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw statusError(401, 'Unauthorized: Invalid session token');
  return getBluePaygAccount(data.user.id);
}
