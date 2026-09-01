"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  user: any | null;
  session: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: false,
  signOut: async () => {},
});

// Public marketing routes do not need a session in order to render. Restricting
// the initial Supabase call to account-aware routes keeps ad traffic from
// producing an auth request for every page view.
const AUTH_AWARE_ROUTES = ["/console", "/subscribe", "/blue-pro", "/checkout"];

function needsSession(pathname: string): boolean {
  return AUTH_AWARE_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!needsSession(pathname)) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    supabase.auth.getSession()
      .then(({ data: { session } }: any) => {
        if (!active) return;
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!active) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
