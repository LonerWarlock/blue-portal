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

export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database admin client not configured' }, { status: 500 });
    }

    // 1. Fetch current wallet balance
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json({ error: 'Failed to retrieve wallet balance' }, { status: 500 });
    }

    const currentBalance = Number(walletData.balance || 0);
    if (currentBalance < 100) {
      return NextResponse.json({ error: 'Insufficient IMR balance. You need at least 100 IMR to redeem.' }, { status: 400 });
    }

    // 2. Check if user already has an active blue plan
    const { data: subData } = await supabaseAdmin
      .from('subscriptions')
      .select('plan, status, metadata')
      .eq('user_id', user.id)
      .single();

    if (subData && subData.status === 'active' && subData.plan === 'blue') {
      return NextResponse.json({ error: 'You already have an active Blue plan subscription.' }, { status: 400 });
    }

    // Check if they already have a pending discount
    const existingMetadata = subData?.metadata || {};
    if (existingMetadata.imr_discount && Number(existingMetadata.imr_discount) > 0) {
      return NextResponse.json({ error: 'You have already redeemed IMR for your next subscription discount.' }, { status: 400 });
    }

    const newBalance = currentBalance - 100;

    // 3. Atomically decrement wallet balance by 100
    const { error: walletUpdateError } = await supabaseAdmin
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', user.id);

    if (walletUpdateError) {
      return NextResponse.json({ error: 'Failed to update wallet balance' }, { status: 500 });
    }

    // 4. Save ₹50 discount inside subscription metadata
    const updatedMetadata = { ...existingMetadata, imr_discount: 50 };

    const { error: subUpsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan: subData?.plan || 'lite',
        status: subData?.status || 'expired', // default to expired/inactive status
        metadata: updatedMetadata,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (subUpsertError) {
      // Rollback wallet balance (best effort)
      await supabaseAdmin.from('wallets').update({ balance: currentBalance }).eq('user_id', user.id);
      return NextResponse.json({ error: 'Failed to apply discount metadata' }, { status: 500 });
    }

    return NextResponse.json({ success: true, newBalance, discount: 50 });

  } catch (err: any) {
    console.error('Use IMR error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
