import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, rateLimitHeaders, requestIp } from '@/lib/trafficControl';
import { BLUE_TEAMS_LIVE_TEST_TIER, getBlueTeamsPlan, isBlueTeamsTier } from '@/lib/blueTeamsPlans';
import { getBlueTeamsCheckoutConfig } from '@/lib/blueTeamsCheckoutMode';
import { getBearerToken } from '@/lib/bluePayg';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (String(process.env.DISABLE_CHECKOUT || '').toLowerCase() === 'true') {
      return NextResponse.json({ error: 'Checkout is temporarily paused.' }, { status: 503 });
    }
    if (!supabaseAdmin) return NextResponse.json({ error: 'Checkout is temporarily unavailable.' }, { status: 503 });
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Please sign in to choose a Blue Teams plan.' }, { status: 401 });
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const limits = await Promise.all([
      checkRateLimit('teams:checkout:user', authData.user.id, { limit: 8, windowSeconds: 10 * 60 }),
      checkRateLimit('teams:checkout:ip', requestIp(request), { limit: 16, windowSeconds: 10 * 60 }),
    ]);
    const blocked = limits.find(result => !result.allowed);
    if (blocked) return NextResponse.json({
      error: blocked.configured ? 'Too many checkout attempts. Please wait and try again.' : 'Checkout is temporarily unavailable.',
    }, { status: blocked.configured ? 429 : 503, headers: rateLimitHeaders(blocked) });

    const config = getBlueTeamsCheckoutConfig();
    if (!config.checkoutEnabled) return NextResponse.json({ error: 'Blue Teams checkout is not enabled yet.' }, { status: 503 });
    const body = await request.json().catch(() => ({}));
    const plan = isBlueTeamsTier(body.tier) ? getBlueTeamsPlan(body.tier) : null;
    if (!plan) return NextResponse.json({ error: 'Choose a valid Blue Teams plan.' }, { status: 400 });
    const sandboxTestMode = config.testMode;
    // This is intentionally server-owned. The temporary public Business
    // launch price can only be enabled in the production environment.
    const liveTestMode = plan.tier === BLUE_TEAMS_LIVE_TEST_TIER && config.liveTestPriceEnabled;
    const testPrice = sandboxTestMode || liveTestMode;

    const { data: session, error } = await supabaseAdmin.from('checkout_sessions').insert({
      user_id: authData.user.id,
      plan: `blue_teams_${plan.tier}`,
      billing_cycle: 'monthly',
      status: 'pending',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      metadata: {
        email: authData.user.email || '',
        product_kind: 'blue_teams',
        product_sku: plan.sku,
        base_price_inr: (testPrice ? 1 : plan.priceInr).toFixed(2),
        base_price_usd: (testPrice ? 0.01 : plan.priceUsd).toFixed(2),
        currency_inr: 'INR', currency_usd: 'USD', duration_days: plan.days,
        blue_teams_test_mode: sandboxTestMode,
        blue_teams_live_test_mode: liveTestMode,
      },
    }).select('id').single();

    if (error || !session) {
      console.error('[Blue Teams] Could not create checkout session:', error);
      return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ session_id: session.id });
  } catch (error) {
    console.error('[Blue Teams] Checkout session failed:', error);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
