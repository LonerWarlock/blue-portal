import { getDesktopStoreReleaseManifest } from '@/lib/desktop-store-release';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public, credential-free release metadata only. No auth/database/model calls,
// request-dependent user data, installer URLs, or automatic task/update actions.
export function GET() {
  return Response.json(getDesktopStoreReleaseManifest(), {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
