import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
  supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_project_url' && 
  supabaseAnonKey !== 'your_supabase_anon_public_key';

const createMockSupabase = () => {
  const dummyPromise = Promise.resolve({ data: { session: null }, error: null });
  const dummyQuery = {
    select: () => dummyQuery,
    eq: () => dummyQuery,
    single: () => Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Supabase is not configured' } }),
    insert: () => dummyQuery,
    update: () => dummyQuery,
  };

  return {
    auth: {
      getSession: () => dummyPromise,
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      }),
      signUp: () => Promise.resolve({ data: { user: null }, error: new Error("Supabase is not configured. Please check your .env.local file.") }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: new Error("Supabase is not configured. Please check your .env.local file.") }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => dummyQuery,
    isMock: true,
  };
};

const customStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    const remember = window.localStorage.getItem('blue_remember_me') !== 'false';
    if (remember) {
      window.localStorage.setItem(key, value);
    } else {
      window.sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storage: customStorage,
        detectSessionInUrl: false
      }
    }) 
  : (createMockSupabase() as any);

