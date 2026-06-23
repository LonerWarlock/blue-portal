import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { MODELS, getModelConfig, ModelConfig } from '@/lib/models';

export const runtime = 'edge';

// Helper to authenticate user from token (handles both Supabase JWT and client blue_ key)
async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Unauthorized: Missing token' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return { authenticated: false, error: 'Unauthorized: Empty token' };
  }

  if (!supabaseAdmin) {
    return { authenticated: false, error: 'Internal Server Error: Supabase Admin not configured' };
  }

  // Case 1: Client API Key (starts with blue_)
  if (token.startsWith('blue_')) {
    const { data: keyRecord, error: dbError } = await supabaseAdmin
      .from('user_keys')
      .select('user_id')
      .eq('key', token)
      .single();

    if (dbError || !keyRecord) {
      return { authenticated: false, error: 'Unauthorized: Invalid Blue API Key' };
    }
    return { authenticated: true, error: null };
  }

  // Case 2: Supabase User Session JWT Token
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { authenticated: false, error: 'Unauthorized: Invalid session token' };
  }
  return { authenticated: true, error: null };
}

export async function GET(request: Request) {
  try {
    // 1. Authenticate caller
    const { authenticated, error } = await authenticateRequest(request);
    if (!authenticated || error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // 2. Retrieve OpenCode Master API Key
    const openCodeKey = process.env.OPENCODE_ZEN_API_KEY;
    if (!openCodeKey || openCodeKey === 'your_opencode_api_key_here') {
      // Fallback to static catalog if master key is not set
      return NextResponse.json({ models: Object.values(MODELS) });
    }

    // 3. Fetch live list from OpenCode
    const response = await fetch('https://opencode.ai/zen/v1/models', {
      headers: {
        'Authorization': `Bearer ${openCodeKey}`
      }
    });

    if (!response.ok) {
      console.warn(`Upstream models fetch failed with status ${response.status}. Using static fallback.`);
      return NextResponse.json({ models: Object.values(MODELS) });
    }

    const result = await response.json();
    const liveModelList: { id: string }[] = result.data || [];

    // Map and merge live models with our structured metadata
    const mergedModels: ModelConfig[] = liveModelList.map((m) => {
      return getModelConfig(m.id);
    });

    return NextResponse.json({ models: mergedModels });

  } catch (error: any) {
    console.error('Failed to load live models list:', error);
    // Fallback to static catalog
    return NextResponse.json({ models: Object.values(MODELS) });
  }
}
