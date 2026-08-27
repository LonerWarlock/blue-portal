import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPackCatalog, getPackConfig } from '@/lib/exchangeRate';

async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized: Missing token' };
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (!supabaseAdmin) return { user: null, error: 'DB not configured' };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { user: null, error: 'Unauthorized: Invalid token' };
  return { user, error: null };
}

export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthUser(request);
    if (error || !user) return NextResponse.json({ error }, { status: 401 });
    if (!supabaseAdmin) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('account_type')
      .eq('user_id', user.id)
      .single();

    if (!wallet || wallet.account_type !== 'pro_payg') {
      return NextResponse.json({ error: 'You need a Blue Pro account to purchase credits' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as { packId?: string };
    const pack = getPackConfig(body.packId);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app';

    return NextResponse.json({
      price_inr: pack.priceINR,
      base_price_usd: pack.priceUSD,
      credits: pack.credits,
      pack_id: pack.id,
      access_tier: pack.accessTier,
      packs: getPackCatalog(),
      return_url: `${siteUrl}/blue-pro/dashboard`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
