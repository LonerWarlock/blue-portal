import { NextResponse } from 'next/server';
import { authenticateBlueKey, getBearerToken } from '@/lib/bluePayg';
import { blockedRuntimeModels } from '@/lib/blueRuntime';
import { getOpenRouterModels, imageGenerationModels, providerModelId } from '@/lib/openrouter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await authenticateBlueKey(getBearerToken(request));
    const blocked = await blockedRuntimeModels();
    const models = imageGenerationModels(await getOpenRouterModels()).filter(model => !blocked.has(model.id))
      .map(model => ({ id: providerModelId(model), displayName: model.name || model.id, imageGeneration: true, isFree: false }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return NextResponse.json({ models }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 500);
    return NextResponse.json({ error: status >= 500 ? 'Blue could not load image models. Please try again shortly.' : error instanceof Error ? error.message : 'Image models are unavailable.' }, { status });
  }
}
