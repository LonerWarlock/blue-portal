import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { getBearerToken, getBluePaygAccount, statusError } from '@/lib/bluePayg';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const userId = await authenticatedEligibleUser(request);
    const { data, error } = await supabaseAdmin!
      .from('user_keys')
      .select('key')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw statusError(500, 'Failed to retrieve Blue API key');
    if (data?.key) return NextResponse.json({ key: data.key });
    return createKey(userId);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return createKey(await authenticatedEligibleUser(request));
  } catch (error) {
    return errorResponse(error);
  }
}

async function authenticatedEligibleUser(request: Request): Promise<string> {
  if (!supabaseAdmin) throw statusError(500, 'Database is not configured');
  const token = getBearerToken(request);
  if (!token) throw statusError(401, 'Unauthorized: Missing token');
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw statusError(401, 'Unauthorized: Invalid token');
  await getBluePaygAccount(data.user.id);
  return data.user.id;
}

async function createKey(userId: string) {
  const key = `blue_${randomBytes(24).toString('base64url')}`;
  const { error } = await supabaseAdmin!
    .from('user_keys')
    .upsert({ user_id: userId, key }, { onConflict: 'user_id' });
  if (error) throw statusError(500, 'Failed to generate Blue API key');
  return NextResponse.json({ key });
}

function errorResponse(error: unknown) {
  const status = Number((error as { status?: number })?.status || 500);
  return NextResponse.json({
    error: error instanceof Error ? error.message : 'Server error'
  }, { status });
}
