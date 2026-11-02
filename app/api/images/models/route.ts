import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache.js';
import { authenticateBlueKey, getBearerToken } from '@/lib/bluePayg';
import { BLUE_RUNTIME_IMAGE_ALLOWANCE, blockedRuntimeModels } from '@/lib/blueRuntime';
import { getOpenRouterModels, imageGenerationModels, imageGenerationRequestPolicy, providerModelId } from '@/lib/openrouter';
import type { OpenRouterModel } from '@/lib/openrouter';
import imageCatalogue from '@/lib/imageModelCatalog.cjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const publicCatalogue = unstable_cache(() => imageCatalogue.loadPublicImageCatalogue(), ['blue-image-catalogue-prices-v1'], { revalidate: 300 });
export async function GET(request: Request) {
  try {
    await authenticateBlueKey(getBearerToken(request));
    const [catalogue, account, blocked] = await Promise.all([publicCatalogue(), getOpenRouterModels(), blockedRuntimeModels()]);
    const authorized = imageGenerationModels(account);
    const source = new Map<string, OpenRouterModel>((catalogue.models as OpenRouterModel[]).map(row => [row.id, row]));
    for (const model of authorized) { const id = providerModelId(model)!; if (!source.has(id)) source.set(id, { ...model, id }); }
    const models = imageCatalogue.buildImageCatalogue(Array.from(source.values()), authorized, new Map(catalogue.endpoints), blocked)
      .map(row => ({ ...row, ...imageGenerationRequestPolicy(authorized.find(model => providerModelId(model) === row.id) || source.get(row.id)!, BLUE_RUNTIME_IMAGE_ALLOWANCE) }));
    return NextResponse.json({ models, image_generation_protocol: 2 }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    return NextResponse.json({ error: status >= 500 ? 'Blue could not load image models. Please try again shortly.' : error instanceof Error ? error.message : 'Image models are unavailable.' }, { status });
  }
}
