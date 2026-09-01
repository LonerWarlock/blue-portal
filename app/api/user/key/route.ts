import { NextResponse } from 'next/server';
import { getBearerToken, getBluePaygAccount, statusError } from '@/lib/bluePayg';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getOrCreateUserKey, rotateUserKey } from '@/lib/userKey';

export async function GET(request: Request) {
  try {
    const userId = await authenticatedEligibleUser(request);
    return NextResponse.json(await getOrCreateUserKey(userId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(await rotateUserKey(await authenticatedEligibleUser(request)));
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

function errorResponse(error: unknown) {
  const status = Number((error as { status?: number })?.status || 500);
  return NextResponse.json({
    error: error instanceof Error ? error.message : 'Server error'
  }, { status });
}
