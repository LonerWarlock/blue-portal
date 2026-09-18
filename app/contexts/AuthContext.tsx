"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AccountCache, AccountBootstrap, WALLET_CACHE_TTL_MS } from "@/lib/accountCache";

interface AuthContextType {
  user: any | null;
  session: any | null;
  loading: boolean;
  account: AccountBootstrap | null;
  accountLoading: boolean;
  accountError: string;
  refreshAccount: (force?: boolean) => Promise<AccountBootstrap | null>;
  invalidateAccount: () => Promise<AccountBootstrap | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: false, account: null, accountLoading: false, accountError: "",
  refreshAccount: async () => null, invalidateAccount: async () => null, signOut: async () => {},
});
const AUTH_AWARE_ROUTES = ["/console", "/subscribe", "/pricing", "/blue-pro", "/checkout"];
function needsSession(pathname: string): boolean {
  return AUTH_AWARE_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const enabled = needsSession(pathname);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<AccountBootstrap | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const sessionRef = useRef<any>(null);
  const cache = useRef(new AccountCache());
  const channel = useRef<BroadcastChannel | null>(null);

  const refreshAccount = useCallback(async (force = false) => {
    const current = sessionRef.current;
    if (!current?.user?.id || !current.access_token) return null;
    const userId = current.user.id;
    cache.current.setAccount(userId);
    const version = cache.current.generation;
    setAccountLoading(!cache.current.peek());
    setAccountError("");
    try {
      const data = await cache.current.get(current.access_token, force);
      if (sessionRef.current?.user?.id !== userId || cache.current.generation !== version) return null;
      setAccount(data);
      return data;
    } catch (error) {
      if (sessionRef.current?.user?.id === userId && cache.current.generation === version) {
        setAccountError(error instanceof Error ? error.message : "Account data could not be loaded.");
      }
      return null;
    } finally {
      if (sessionRef.current?.user?.id === userId && cache.current.generation === version) setAccountLoading(false);
    }
  }, []);

  const invalidateAccount = useCallback(async () => {
    cache.current.invalidate();
    channel.current?.postMessage({ type: "account-invalidated", userId: sessionRef.current?.user?.id });
    return refreshAccount(true);
  }, [refreshAccount]);

  const authEnabled = enabled || Boolean(session);
  useEffect(() => {
    // Subscribe once per authenticated area, not once per navigation.
    if (!authEnabled) { setLoading(false); return; }
    let active = true;
    const acceptSession = (next: any) => {
      if (!active) return;
      const changed = sessionRef.current?.user?.id !== next?.user?.id;
      sessionRef.current = next;
      cache.current.setAccount(next?.user?.id || null);
      if (changed || !next) { setAccount(null); setAccountError(""); setAccountLoading(false); }
      setSession(next);
      setLoading(false);
    };
    setLoading(!sessionRef.current?.user && !cache.current.peek());
    let authEventSeen = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, next: any) => {
      authEventSeen = true;
      acceptSession(next);
    });
    supabase.auth.getSession().then(({ data: { session: next } }: any) => {
      if (!authEventSeen) acceptSession(next);
    }).catch(() => { if (!authEventSeen) acceptSession(null); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [authEnabled]);

  useEffect(() => {
    if (enabled && session?.user?.id) void refreshAccount();
  }, [enabled, pathname, session, refreshAccount]);

  useEffect(() => {
    if (!enabled || !session?.user?.id) return;
    const revalidate = () => {
      if (document.visibilityState !== "hidden") void refreshAccount();
    };
    const interval = window.setInterval(revalidate, WALLET_CACHE_TTL_MS);
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("blue.account-cache.v1");
      channel.current.onmessage = event => {
        if (event.data?.type === "account-invalidated" && event.data.userId === sessionRef.current?.user?.id) {
          cache.current.invalidate();
          void refreshAccount(true);
        }
      };
    }
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
      channel.current?.close();
      channel.current = null;
    };
  }, [enabled, session?.user?.id, refreshAccount]);

  const signOut = async () => {
    // Clear private cached data before network work; old requests cannot repopulate it.
    cache.current.setAccount(null);
    sessionRef.current = null;
    setAccount(null); setSession(null); setAccountError(""); setAccountLoading(false);
    await supabase.auth.signOut();
  };
  const visibleAccount = account?.user_id === session?.user?.id ? account : null;
  return <AuthContext.Provider value={{
    user: session?.user || null, session, loading, account: visibleAccount,
    accountLoading, accountError, refreshAccount, invalidateAccount, signOut,
  }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
