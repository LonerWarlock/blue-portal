import { NextResponse } from 'next/server';
import { mcpOAuthClientMetadata } from '@/lib/mcpOAuthClientMetadata.cjs';

export const runtime = 'edge';

export function GET(request: Request) {
  const metadata = mcpOAuthClientMetadata(request.url);
  if (!metadata) return NextResponse.json({ error: 'Invalid Blue OAuth client metadata request.' }, { status: 400 });
  return NextResponse.json(metadata, {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'X-Content-Type-Options': 'nosniff' }
  });
}
