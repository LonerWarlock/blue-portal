import { NextResponse } from 'next/server';
import { ACCOUNT_NO_STORE_HEADERS, verifiedSessionUser } from '@/lib/accountEntitlements';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, rateLimitHeaders } from '@/lib/trafficControl';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const userId = await verifiedSessionUser(request);
    const body = await request.json().catch(() => null);
    const raw = body?.couponCode ?? body?.code;
    if (typeof raw !== 'string' || !/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(raw.trim().toUpperCase())) {
      return NextResponse.json({ error: 'Please enter a valid coupon code.' }, { status: 400, headers: ACCOUNT_NO_STORE_HEADERS });
    }
    const rate = await checkRateLimit('coupon:claim', userId, { limit: 10, windowSeconds: 60 });
    if (!rate.allowed) return NextResponse.json({ error: 'Too many attempts. Please wait and try again.' }, {
      status: 429, headers: { ...ACCOUNT_NO_STORE_HEADERS, ...rateLimitHeaders(rate) },
    });
    // Coupon validation, usage limits, redemption logging and wallet increment
    // all commit in one server-only database transaction.
    const { data, error } = await supabaseAdmin!.rpc('claim_imr_coupon', {
      user_id_param: userId, coupon_code_param: raw.trim().toUpperCase(),
    });
    if (error) {
      console.error('[coupon] Atomic claim unavailable:', error.code);
      return NextResponse.json({ error: 'Coupon service temporarily unavailable. No claim was confirmed.' }, {
        status: 503, headers: ACCOUNT_NO_STORE_HEADERS,
      });
    }
    if (!data?.success) return NextResponse.json({ error: data?.error || 'Unable to claim this coupon.' }, {
      status: Number(data?.status || 400), headers: ACCOUNT_NO_STORE_HEADERS,
    });
    return NextResponse.json(data, { headers: ACCOUNT_NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Coupon service unavailable' }, {
      status: Number((error as { status?: number })?.status || 503), headers: ACCOUNT_NO_STORE_HEADERS,
    });
  }
}
