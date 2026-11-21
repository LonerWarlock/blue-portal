import { handleBlueProxy } from '@/lib/blueInferenceProxy.mjs';
import { VERCEL_PROXY_BASE_URL } from '@/lib/blueProxyEndpoints.mjs';

// Vercel's Node runtime supports quiet image/JSON requests. The optional
// Cloudflare Worker uses the exact same Web-API-only proxy implementation.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleBlueProxy(request, { env: {
    // A task ticket minted for another audience cannot be used here.
    BLUE_RUNTIME_PROXY_BASE_URL: VERCEL_PROXY_BASE_URL,
    BLUE_TASK_TICKET_SECRET: process.env.BLUE_TASK_TICKET_SECRET,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  }, maxRequestBytes: 4_000_000 });
}
