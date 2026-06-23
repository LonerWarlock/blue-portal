import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Helper to authenticate user from token
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

// GET: Fetch current API key, auto-generate if missing
export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!supabaseAdmin) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    // 1. Fetch API Key
    let { data: keyData, error: keyError } = await supabaseAdmin
      .from('user_keys')
      .select('key')
      .eq('user_id', user.id)
      .single();

    if (keyError && keyError.code === 'PGRST116') {
      // Key doesn't exist, create a new one
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let keyString = 'blue_';
      for (let i = 0; i < 32; i++) {
        keyString += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('user_keys')
        .insert({ user_id: user.id, key: keyString })
        .select('key')
        .single();

      if (insertError) {
        console.error('Insert API key error:', insertError);
        return NextResponse.json({ error: 'Failed to generate API key' }, { status: 500 });
      }

      keyData = insertData;
    } else if (keyError) {
      console.error('Fetch API key error:', keyError);
      return NextResponse.json({ error: 'Failed to retrieve API key' }, { status: 500 });
    }

    return NextResponse.json({ key: keyData?.key || '' });

  } catch (err: any) {
    console.error('Fetch API key route error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// POST: Rotate/Update API Key
export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!supabaseAdmin) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    // Generate new key
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let keyString = 'blue_';
    for (let i = 0; i < 32; i++) {
      keyString += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_keys')
      .upsert({ user_id: user.id, key: keyString }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('Rotate API key error:', updateError);
      return NextResponse.json({ error: 'Failed to rotate API key' }, { status: 500 });
    }

    return NextResponse.json({ key: keyString });

  } catch (err: any) {
    console.error('Rotate API key route error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
