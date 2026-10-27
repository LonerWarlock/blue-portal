import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, rateLimitHeaders, type RateLimitResult } from '@/lib/trafficControl';
import { DESKTOP_ACTIVITY_MAX_BYTES, validateDesktopActivity } from '@/lib/desktopActivity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const PRIVATE = {'Cache-Control': 'private, no-store'};
function unavailable() {
  return NextResponse.json({error: 'Activity reporting is temporarily unavailable.'}, {status: 503, headers: PRIVATE});
}

/** Both limiters are shared across instances; never fall back to an unbounded local map. */
async function activityRateLimit(userId: string): Promise<RateLimitResult> {
  const redis = await checkRateLimit('desktop:activity:user', userId, {limit: 120, windowSeconds: 60});
  if (redis.configured) return redis;
  const {data, error} = await supabaseAdmin!.rpc('limit_desktop_activity', {user_id_param: userId});
  if (error || !data || typeof data.allowed !== 'boolean'
    || !Number.isInteger(data.remaining) || data.remaining < 0 || data.remaining > 120
    || !Number.isInteger(data.retry_after_seconds) || data.retry_after_seconds < 0 || data.retry_after_seconds > 60
    || (data.allowed && (data.retry_after_seconds !== 0 || data.remaining > 119))
    || (!data.allowed && (data.remaining !== 0 || data.retry_after_seconds < 1))) return redis;
  return {configured: true, allowed: data.allowed, limit: 120, remaining: data.remaining,
    retryAfterSeconds: data.retry_after_seconds};
}

/** Read a bounded stream, rather than trusting Content-Length or buffering arbitrary JSON. */
async function boundedBody(request: Request): Promise<string | null> {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^[0-9]+$/.test(declared) || Number(declared) > DESKTOP_ACTIVITY_MAX_BYTES)) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let size = 0, result = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > DESKTOP_ACTIVITY_MAX_BYTES) { await reader.cancel(); return null; }
      result += decoder.decode(value, {stream: true});
    }
    return result + decoder.decode();
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return unavailable();
    const authorization = request.headers.get('authorization') || '';
    const match = /^Bearer ([^\s,]{1,8192})$/i.exec(authorization);
    if (!match) return NextResponse.json({error: 'Sign in to report activity.'}, {status: 401, headers: PRIVATE});
    const {data: auth, error: authError} = await supabaseAdmin.auth.getUser(match[1]);
    if (authError || !auth?.user?.id) return NextResponse.json({error: 'Sign in again.'}, {status: 401, headers: PRIVATE});

    // Missing Redis must not disable reporting. The database provides the same
    // per-account limit; if both stores are unavailable, keep the client outbox.
    const limit = await activityRateLimit(auth.user.id);
    if (!limit.configured) return unavailable();
    if (!limit.allowed) return NextResponse.json({error: 'Please retry activity reporting later.'},
      {status: 429, headers: {...PRIVATE, ...rateLimitHeaders(limit)}});
    if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
      return NextResponse.json({error: 'A JSON activity batch is required.'}, {status: 415, headers: PRIVATE});
    }
    let body;
    try {
      const text = await boundedBody(request);
      if (text === null) return NextResponse.json({error: 'Activity batch is too large.'}, {status: 413, headers: PRIVATE});
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({error: 'Invalid activity batch.'}, {status: 400, headers: PRIVATE});
    }
    const batch = validateDesktopActivity(body);
    if (!batch) return NextResponse.json({error: 'Invalid activity batch.'}, {status: 400, headers: PRIVATE});
    const {data, error} = await supabaseAdmin.rpc('record_desktop_activity', {
      user_id_param: auth.user.id, session_id_param: batch.session_id, app_version_param: batch.app_version,
      presence_param: batch.presence, runs_param: batch.runs,
    });
    if (error || !data) return unavailable();
    return NextResponse.json(data, {headers: PRIVATE});
  } catch { return unavailable(); }
}
