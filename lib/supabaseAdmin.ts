import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const publicAuthKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const supabaseAuthKey = publicAuthKey && !publicAuthKey.startsWith('your_')
  ? publicAuthKey : supabaseServiceKey;

const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
};

const isConfigured = 
  isValidUrl(supabaseUrl) && 
  supabaseServiceKey && 
  supabaseServiceKey !== 'your_supabase_service_role_key';

export const supabaseAdmin = isConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      // persistSession:false still keeps OTP sessions in memory. Database
      // authorization must never change to a previously signed-in user.
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    })
  : null;

/** A new in-memory auth client for each request; never shared with database reads. */
export const createSupabaseAuthClient = () => isConfigured
  ? createClient(supabaseUrl, supabaseAuthKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;
