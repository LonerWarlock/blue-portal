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
    // Quote and admission are one database transaction: current access and any
    // unresolved payment attempts are checked under the same account lock.
    const { data, error } = await supabaseAdmin.rpc('create_blue_teams_checkout', {
      user_id_param:authData.user.id,tier_param:plan.tier,
      is_test_param:sandboxTestMode,live_test_param:liveTestMode,
    });
    if (error || !data?.session_id) {
      // Return only allowlisted billing guidance, not arbitrary database errors.
      const message = error?.message || '';
      const guidance = /collected Teams payment is awaiting review|Multiple Teams checkout attempts need reconciliation/.test(message)
        ? 'A previous payment needs review. Do not pay again; contact support to reconcile the receipt.'
        : /previous Teams checkout is still pending/.test(message)
          ? 'A previous Teams checkout is still pending. Finish or resolve it before choosing another plan.'
          : /lower Teams plan starts only after/.test(message)
            ? 'Your current plan stays active until expiry. Choose Change at expiry to save a lower plan without paying now.'
            : /manual billing review/.test(message)
              ? 'This upgrade needs a billing review to preserve your prepaid balance. No payment was started; contact support.'
              : /checkout is no longer available|Teams access changed|Teams plan changed/.test(message)
                ? 'Your Teams access changed. Refresh your current plan before starting another checkout.'
                : null;
      return NextResponse.json({ error: guidance || 'Could not prepare a verified payment quote. No payment was started.' }, { status:guidance ? 409 : 503 });
    }
    return NextResponse.json(data, {headers:{'Cache-Control':'private, no-store'}});
  } catch (error) {
    console.error('[Blue Teams] Checkout session failed:', error);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
