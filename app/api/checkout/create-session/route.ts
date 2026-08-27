import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const plan = body.plan || 'blue';
    const billingCycle = body.billing_cycle || 'monthly';

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
          imr_discount: imrDiscount
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
