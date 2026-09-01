import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, rateLimitHeaders, requestIp } from '@/lib/trafficControl';

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized: Missing token' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) {
    return { user: null, error: 'Internal Server Error: Supabase Admin not configured' };
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { user: null, error: 'Unauthorized: Invalid token' };
  }

  return { user, error: null };
}

// POST: Create a checkout session for subscription redirect
export async function POST(request: Request) {
  try {
    if (String(process.env.DISABLE_CHECKOUT || '').toLowerCase() === 'true') {
      return NextResponse.json({ error: 'Checkout is temporarily paused.' }, { status: 503 });
    }
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const limits = await Promise.all([
      checkRateLimit('checkout:user', user.id, { limit: 10, windowSeconds: 10 * 60 }),
      checkRateLimit('checkout:ip', requestIp(request), { limit: 20, windowSeconds: 10 * 60 })
    ]);
    const blocked = limits.find(result => !result.allowed);
    if (blocked) {
      return NextResponse.json({
        error: blocked.configured ? 'Too many checkout attempts. Please wait and try again.' : 'Checkout is temporarily unavailable.'
      }, {
        status: blocked.configured ? 429 : 503,
        headers: rateLimitHeaders(blocked)
      });
    }

    const body = await request.json().catch(() => ({}));
    const plan = String(body.plan || 'blue');
    const billingCycle = String(body.billing_cycle || 'monthly');
    if (plan !== 'blue' || billingCycle !== 'monthly') {
      return NextResponse.json({ error: 'Unsupported product or billing cycle' }, { status: 400 });
    }

    // Fetch active IMR discount
    let imrDiscount = 0;
    try {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('metadata')
        .eq('user_id', user.id)
        .single();
      if (sub && sub.metadata) {
        imrDiscount = Number(sub.metadata.imr_discount || 0);
      }
    } catch (e) {
      console.error('Fetch discount error:', e);
    }

    // Create a checkout session with 15-min expiry
    const { data: session, error: insertError } = await supabaseAdmin
      .from('checkout_sessions')
      .insert({
        user_id: user.id,
        plan,
        billing_cycle: billingCycle,
        status: 'pending',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        metadata: { 
          email: user.email,
          imr_discount: imrDiscount,
          product_sku: 'blue_monthly_inr',
          base_price_inr: '149.00',
          base_price_usd: '1.99',
          currency_inr: 'INR',
          currency_usd: 'USD',
        },
      })
      .select('id')
      .single();

    if (insertError || !session) {
      console.error('Create checkout session error:', insertError);
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    return NextResponse.json({ session_id: session.id });
  } catch (err: any) {
    console.error('Create session route error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
