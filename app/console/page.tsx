"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TIER_BADGE_COLORS: Record<string, string> = {
  "Low Cost": "bg-green-950/60 text-green-400 border border-green-900/60",
  "Standard": "bg-blue-950/60 text-blue-400 border border-blue-900/60",
  "High Cost": "bg-yellow-950/60 text-yellow-400 border border-yellow-900/60",
  "Premium": "bg-purple-950/60 text-purple-400 border border-purple-900/60",
};

const MODEL_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const BLUE_WALLET_REFRESH_INTERVAL_MS = 30 * 1000;
const MODEL_CATALOG_SESSION_KEY = 'blue.modelCatalog.v1';
let modelCatalogCache: any[] = [];
let modelCatalogLoadedAt = 0;
let modelCatalogRequest: Promise<any[]> | null = null;

function restoreModelCatalogCache(): void {
  if (typeof window === 'undefined' || modelCatalogCache.length > 0) return;
  try {
    const saved = JSON.parse(sessionStorage.getItem(MODEL_CATALOG_SESSION_KEY) || 'null');
    if (!saved || !Array.isArray(saved.models) || saved.models.length === 0) return;
    modelCatalogCache = saved.models;
    modelCatalogLoadedAt = Number(saved.loadedAt || 0);
  } catch {
    sessionStorage.removeItem(MODEL_CATALOG_SESSION_KEY);
  }
}

async function getModelCatalog(force = false): Promise<any[]> {
  if (!force && modelCatalogCache.length > 0 && Date.now() - modelCatalogLoadedAt < MODEL_CATALOG_CACHE_TTL_MS) {
    return modelCatalogCache;
  }
  if (modelCatalogRequest) return modelCatalogRequest;
  modelCatalogRequest = (async () => {
    const response = await fetch('/api/models?catalog=public');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The model catalog could not be loaded.');
    if (!Array.isArray(payload.models) || payload.models.length === 0) {
      throw new Error('The provider returned an empty model catalog.');
    }
    modelCatalogCache = payload.models;
    modelCatalogLoadedAt = Date.now();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(MODEL_CATALOG_SESSION_KEY, JSON.stringify({
        models: modelCatalogCache,
        loadedAt: modelCatalogLoadedAt
      }));
    }
    return modelCatalogCache;
  })();
  try {
    return await modelCatalogRequest;
  } finally {
    modelCatalogRequest = null;
  }
}

function modelTier(inputCredits: number, outputCredits: number) {
  const highest = Math.max(inputCredits, outputCredits);
  if (highest <= 1) return "Low Cost";
  if (highest <= 5) return "Standard";
  if (highest <= 15) return "High Cost";
  return "Premium";
}

export default function ConsolePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // Auth Form State
  const [authError, setAuthError] = useState("");
  const [authStatusMessage, setAuthStatusMessage] = useState("");

  // Console State
  const [currentApiKey, setCurrentApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [balance, setBalance] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [plan, setPlan] = useState<string>("lite");
  const [discount, setDiscount] = useState<number>(0);
  const [isProPayg, setIsProPayg] = useState(false);
  const [hasBlueCredits, setHasBlueCredits] = useState(false);
  const [proWallet, setProWallet] = useState<any>(null);
  const [proTransactions, setProTransactions] = useState<any[]>([]);
  const [proUsage, setProUsage] = useState<any>(null);
  const [proPackConfig, setProPackConfig] = useState<any>({ priceINR: 100, credits: 1 });
  const [proTab, setProTab] = useState<"overview" | "purchases" | "usage">("overview");

  // Model catalog search and category filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [modelsList, setModelsList] = useState<any[]>(() => modelCatalogCache);
  const [modelsLoading, setModelsLoading] = useState(modelCatalogCache.length === 0);
  const [modelsError, setModelsError] = useState("");

  useEffect(() => {
    restoreModelCatalogCache();
    if (modelCatalogCache.length > 0) {
      setModelsList(modelCatalogCache);
      setModelsLoading(false);
    }
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setCurrentApiKey("");
        setBalance(0);
        setPlan("lite");
        setDiscount(0);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const redirect = sessionStorage.getItem("redirectAfterLogin");
      if (redirect) {
        sessionStorage.removeItem("redirectAfterLogin");
        router.push(redirect);
      }
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    if (paymentStatus) {
      if (paymentStatus === 'success') {
        showSuccess(
          "Subscription Active!", 
          "Your Blue plan subscription has been successfully activated. You now have full access to premium orchestration models!"
        );
      } else if (paymentStatus === 'failed') {
        showError(
          "Payment Cancelled", 
          "The checkout payment process was cancelled or failed. Your wallet balance has not been debited."
        );
      }
      // Smoothly remove payment query parameters from browser address bar
      window.history.replaceState(null, '', '/console');
    }
  }, [loading]);

  const refreshModelCatalog = async (force = false) => {
    const hasCachedCatalog = modelCatalogCache.length > 0;
    if (hasCachedCatalog) setModelsList(modelCatalogCache);
    setModelsLoading(!hasCachedCatalog);
    setModelsError('');
    try {
      setModelsList(await getModelCatalog(force));
    } catch (error) {
      if (!hasCachedCatalog) {
        setModelsError(error instanceof Error ? error.message : 'The model catalog could not be loaded.');
      }
    } finally {
      setModelsLoading(false);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;

      void refreshModelCatalog();

      // Parallelize wallet, subscription, pack-config, and Blue Pro wallet requests
      const [walletRes, packRes, subRes, proRes] = await Promise.all([
        fetch('/api/user/wallet', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/blue-pro/pack-config'),
        fetch(`/api/user/subscription?email=${encodeURIComponent(session.user.email || '')}`),
        fetch('/api/blue-pro/wallet', {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        })
      ]);

      if (walletRes.ok) {
        const walletData = await walletRes.json();
        if (walletData.balance !== undefined) setBalance(walletData.balance);
      }
      if (packRes.ok) setProPackConfig(await packRes.json());

      let fetchedPlan = 'lite';
      let fetchedDiscount = 0;
      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.plan) fetchedPlan = subData.plan;
        if (subData.discount !== undefined) fetchedDiscount = subData.discount;
      }

      let nextIsProPayg = false;
      let nextProWallet: any = null;
      let nextHasBlueCredits = false;

      if (proRes.ok) {
        const proData = await proRes.json();
        if (proData.eligible && proData.account_type === 'pro_payg') {
          nextIsProPayg = true;
          fetchedPlan = 'blue_pro';
          nextProWallet = proData;
          nextHasBlueCredits = Number(proData.blue_credits || 0) > 0;

          const [keyRes, txnRes, usageRes] = await Promise.all([
            fetch('/api/user/key', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/blue-pro/transactions', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/blue-pro/usage?days=30', { headers: { 'Authorization': `Bearer ${token}` } })
          ]);

          if (keyRes.ok) setCurrentApiKey((await keyRes.json()).key || '');
          if (txnRes.ok) {
            const txnData = await txnRes.json();
            setProTransactions(txnData.transactions || []);
          }
          if (usageRes.ok) {
            const usageData = await usageRes.json();
            setProUsage(usageData);
          }
        }
      }

      // Synchronously update all plan states to prevent UI flickering between Blue and Blue Pro
      setPlan(fetchedPlan);
      setDiscount(fetchedDiscount);
      setIsProPayg(nextIsProPayg);
      setProWallet(nextProWallet);
      setHasBlueCredits(nextHasBlueCredits);
    } catch (err) {
      console.error("Error loading user data:", err);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    let disposed = false;
    let refreshInFlight = false;

    const refreshBlueWallet = async () => {
      if (disposed || refreshInFlight || document.visibilityState === 'hidden') return;
      refreshInFlight = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || disposed) return;

        const response = await fetch(`/api/blue-pro/wallet?t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
          cache: 'no-store'
        });
        if (!response.ok || disposed) return;

        const wallet = await response.json();
        if (!wallet.eligible || wallet.account_type !== 'pro_payg') return;
        setProWallet(wallet);
        setHasBlueCredits(Number(wallet.blue_credits || 0) > 0);
      } catch (error) {
        console.error('Error refreshing Blue Credits:', error);
      } finally {
        refreshInFlight = false;
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshBlueWallet();
    };

    const interval = window.setInterval(() => void refreshBlueWallet(), BLUE_WALLET_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [user?.id]);

  const handleGoogleLogin = async () => {
    setAuthError("");
    setAuthStatusMessage("");
    try {
      if (supabase.isMock) {
        setAuthStatusMessage("Demo Mode: Logging in with Google...");
        setTimeout(() => {
          const demoUser = { id: "demo_google_user", email: "team.imergene@gmail.com" };
          setUser(demoUser);
          setCurrentApiKey("blue_demo_key_google_123");
          setBalance(1.00);
          setAuthStatusMessage("");
        }, 800);
        return;
      }

      setAuthStatusMessage("Redirecting to Google...");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/console`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign in with Google.");
      setAuthStatusMessage("");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(currentApiKey).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1500);
    });
  };

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "success" | "error" | "confirm";
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  const showInfo = (title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, type: "info" });
  };

  const showSuccess = (title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, type: "success" });
  };

  const showError = (title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, type: "error" });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type: "confirm",
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleRotateKey = () => {
    showConfirm(
      "Rotate API Key",
      "Are you sure you want to rotate your API Key? The old key will stop working immediately inside your VS Code extension.",
      async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          const token = session.access_token;

          setAuthStatusMessage("Rotating key...");
          const keyRes = await fetch('/api/user/key', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const keyData = await keyRes.json();
          if (!keyRes.ok || keyData.error) throw new Error(keyData.error || 'Failed to rotate key');
          setCurrentApiKey(keyData.key);
          setAuthStatusMessage("");
          showSuccess("Key Rotated", "API key successfully rotated!");
        } catch (err: any) {
          setAuthStatusMessage("");
          showError("Rotation Failed", err.message);
        }
      }
    );
  };

  const [redeeming, setRedeeming] = useState(false);

  const handleUseIMR = () => {
    if (plan === 'blue') {
      showInfo("Plan Active", "You already have an active Blue plan subscription.");
      return;
    }

    if (discount > 0) {
      showInfo("Discount Active", "You have already redeemed IMR for your next subscription discount.");
      return;
    }

    if (balance < 100) {
      showError("Insufficient Balance", "Insufficient IMR balance. You need at least 100 IMR to redeem.");
      return;
    }

    showConfirm(
      "Redeem IMR",
      "Are you sure you want to redeem 100 IMR to apply a ₹50 discount on your next Blue subscription?",
      async () => {
        setRedeeming(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            showError("Authentication Error", "Session expired. Please log in again.");
            setRedeeming(false);
            return;
          }
          const token = session.access_token;

          const res = await fetch('/api/user/use-imr', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || 'Failed to redeem IMR');
          }

          setBalance(data.newBalance);
          setDiscount(data.discount || 50);
          showSuccess("Discount Applied", "Successfully redeemed 100 IMR! A ₹50 discount has been applied to your next Blue subscription checkout.");
        } catch (err: any) {
          showError("Redemption Failed", err.message);
        } finally {
          setRedeeming(false);
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <header className="w-full glass py-4 px-6 border-b border-gray-800/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <a href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <i className="fa-solid fa-robot text-lg text-white"></i>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Blue AI</span>
              <span className="text-xs block text-gray-500 font-medium">Developer Console</span>
            </div>
          </a>

          <nav className="hidden md:flex items-center space-x-6">
            <a href="/" className="text-sm text-gray-400 hover:text-gray-200 transition">Home</a>
            <a href="/subscribe" className="text-sm text-gray-400 hover:text-gray-200 transition">Subscribe</a>
            <a href="/pricing" className="text-sm text-gray-400 hover:text-gray-200 transition">Pricing</a>
            <a href="/docs" className="text-sm text-gray-400 hover:text-gray-200 transition">Docs</a>
            <a href="/blog" className="text-sm text-gray-400 hover:text-gray-200 transition">Blog</a>
          </nav>

              {user && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-400 font-medium hidden sm:inline">{user.email}</span>
                  {isProPayg ? (
                    <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-lg bg-purple-950/60 border border-purple-500/30 text-xs font-bold text-purple-400">
                      <i className="fa-solid fa-bolt mr-1.5 text-[10px]"></i>
                      Blue Pro
                    </span>
                  ) : plan === "blue" ? (
                    <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-lg bg-blue-950/60 border border-blue-500/30 text-xs font-bold text-blue-400">
                      <i className="fa-solid fa-crown mr-1.5 text-[10px]"></i>
                      Blue Active
                    </span>
                  ) : (
                    <>
                      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-green-950/60 border border-green-500/30 text-[10px] font-bold text-green-400">
                        Blue Lite
                      </span>
                      <a
                        href="/subscribe"
                        className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg border border-blue-800/50 text-sm font-semibold text-blue-400 hover:text-white hover:bg-blue-600/20 transition duration-200"
                      >
                        <i className="fa-solid fa-crown mr-1.5 text-[10px]"></i>
                        Upgrade
                      </a>
                    </>
                  )}
                  <button onClick={handleLogout} className="px-4 py-1.5 rounded-lg border border-gray-800 text-sm font-semibold hover:bg-gray-800/50 hover:text-white transition duration-200">
                    Sign Out
                  </button>
                </div>
              )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex flex-col justify-center items-center">
        {supabase.isMock && (
          <div className="w-full max-w-md mb-8 p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl text-amber-300 text-sm text-center flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>Supabase Credentials Not Configured</span>
            </div>
            <p className="text-xs text-amber-400/85">
              The portal is running in <strong>Demo Mode</strong>. Please create a <code>.env.local</code> file with your Supabase credentials to enable auth, database persistence, and API keys.
            </p>
          </div>
        )}

        {!user ? (
          <div className="w-full max-w-md p-8 rounded-2xl glass shadow-2xl relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
              <p className="text-sm text-gray-400 mt-2">
                Sign in with your Google account to access your developer console.
              </p>
            </div>

            <button 
              onClick={handleGoogleLogin} 
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white text-gray-900 font-semibold shadow-lg hover:bg-gray-100 active:scale-[0.98] transition duration-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.72 14.92 1 12 1 7.35 1 3.37 3.68 1.34 7.6l3.86 3C6.12 7.6 8.84 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.58v2.98h3.91c2.28-2.1 3.54-5.19 3.54-8.71z" />
                <path fill="#FBBC05" d="M5.2 14.4c-.23-.69-.36-1.43-.36-2.2s.13-1.51.36-2.2L1.34 7.01C.48 8.71 0 10.3 0 12s.48 3.29 1.34 4.99l3.86-2.59z" />
                <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.91-2.98c-1.08.72-2.45 1.16-4.02 1.16-3.16 0-5.88-2.56-6.8-5.56L1.34 16.3C3.37 20.32 7.35 23 12 23z" />
              </svg>
              <span>Sign in with Google</span>
            </button>

            {authStatusMessage && (
              <div className="mt-6 p-3 bg-blue-950/40 border border-blue-800/80 rounded-xl text-blue-400 text-xs text-center font-medium">
                {authStatusMessage}
              </div>
            )}

            {authError && (
              <div className="mt-6 p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-red-400 text-xs text-center font-medium">
                {authError}
              </div>
            )}
          </div>
        ) : (
          
          <div className="w-full space-y-10">
            
            <div className={`grid grid-cols-1 ${isProPayg ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-8`}>
              
              {isProPayg && (
                <div className="lg:col-span-1 p-6 rounded-2xl glass border border-purple-900/40 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Blue Credits</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-purple-950/60 border border-purple-900/60 text-purple-400">
                        PAYG
                      </span>
                    </div>
                    <span className="text-4xl font-extrabold tracking-tight mt-2 block bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                      {Number(proWallet?.blue_credits || 0).toFixed(4)}
                    </span>
                    <span className="text-xs text-gray-500 mt-1 block">Available credits</span>
                    {hasBlueCredits && (
                      <span className="text-[20px] text-gray-500 mt-2 block font-mono">
                        {proWallet?.total_purchased?.toFixed(2) || "0"} lifetime purchased
                      </span>
                    )}
                  </div>
                  <div className="mt-6 flex space-x-3">
                    <a href="/blue-pro/checkout"
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-semibold text-white shadow-md hover:from-purple-500 hover:to-pink-500 transition inline-flex items-center justify-center gap-2">
                      <i className="fa-solid fa-cart-plus text-xs"></i>
                      Add Credits
                    </a>
                  </div>
                  {!hasBlueCredits && (
                    <a href="/blue-pro" className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-purple-400 hover:text-purple-300 transition">
                      <i className="fa-solid fa-circle-info"></i>
                      Learn about Blue Pro
                    </a>
                  )}
                </div>
              )}

              <div className={`p-6 rounded-2xl glass relative overflow-hidden flex flex-col justify-between min-h-[220px] ${isProPayg ? 'lg:col-span-1' : 'lg:col-span-1'}`}>
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">IMR Balance</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      isProPayg
                        ? 'bg-purple-950/60 border border-purple-900/60 text-purple-400'
                        : plan === 'blue'
                        ? 'bg-blue-950/60 border border-blue-900/60 text-blue-400'
                        : 'bg-green-950/60 border border-green-900/60 text-green-400'
                    }`}>
                      {isProPayg ? 'Blue Pro' : plan === 'blue' ? 'Blue' : 'Blue Lite'}
                    </span>
                  </div>
                  <span className="text-4xl font-extrabold tracking-tight mt-2 block bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    {balance.toFixed(0)} IMR
                  </span>
                  <span className="text-xs text-gray-500 mt-1 block">Refilled from Imergene Promo</span>
                  <span className="text-[20px] text-gray-500 mt-2 block font-mono">1 IMR = ₹0.50 (INR)</span>
                </div>
                <div className="mt-6 flex space-x-3">
                  {hasBlueCredits ? null : plan === 'blue' ? (
                    <a
                      href="/subscribe"
                      className="flex-1 py-2.5 px-4 rounded-xl border border-blue-500/30 text-blue-400 text-sm font-semibold hover:bg-blue-600/10 transition duration-200 inline-flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-check text-xs"></i>
                      Active Plan
                    </a>
                  ) : (
                    <a
                      href="/subscribe"
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-semibold text-white shadow-md hover:from-purple-500 hover:to-pink-500 transition duration-200 inline-flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-crown text-xs"></i>
                      Upgrade
                    </a>
                  )}
                  <button className="py-2.5 px-4 rounded-xl border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition">
                    History
                  </button>
                </div>
                {isProPayg && !hasBlueCredits ? (
                  <a href="/blue-pro/checkout" className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-purple-400 hover:text-purple-300 transition">
                    <i className="fa-solid fa-cart-plus"></i>
                    Buy your first Blue Credits pack
                  </a>
                ) : !isProPayg && (
                  <a href="/blue-pro" className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-purple-400 hover:text-purple-300 transition">
                    <i className="fa-solid fa-bolt"></i>
                    Try Blue Pro for ₹100 — no subscription or expiry
                  </a>
                )}
              </div>

              <div className="lg:col-span-2 p-6 rounded-2xl glass relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                {!hasBlueCredits && (
                  <div className="absolute inset-0 bg-[#030712]/75 backdrop-blur-[3px] z-10 flex flex-col items-center justify-center p-6 text-center select-none">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/5">
                      <i className="fa-solid fa-lock text-blue-400 text-lg"></i>
                    </div>
                    <h4 className="text-sm font-bold text-gray-200 tracking-tight">Add Blue Credits to continue</h4>
                    <p className="text-xs text-gray-400 max-w-sm mt-1.5 leading-relaxed">
                      Start with the renewable ₹100 trial or choose the ₹1,500 full-access pack.
                    </p>
                    <a href="/blue-pro/checkout?pack=starter" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-xs font-bold text-white">
                      <i className="fa-solid fa-cart-plus"></i>
                      Buy ₹100 Trial
                    </a>
                  </div>
                )}

                <div className={`flex flex-col justify-between h-full w-full ${!hasBlueCredits ? 'filter blur-[1.5px] opacity-35 select-none pointer-events-none' : ''}`}>
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Your Blue API Key</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      This key will be utilized for future direct payment/token usage updates.
                    </p>
                    
                    <div className="mt-4 flex items-center space-x-2">
                      <div className="relative flex-1">
                        <input 
                          type={apiKeyVisible ? "text" : "password"}
                          readOnly 
                          value={currentApiKey} 
                          className="w-full bg-gray-950 border border-gray-800/80 rounded-xl py-3 px-4 text-xs font-mono text-indigo-300 focus:outline-none"
                        />
                        <button onClick={() => setApiKeyVisible(!apiKeyVisible)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300">
                          <i className={`fa-solid ${apiKeyVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                      <button onClick={handleCopyKey} className="p-3 bg-gray-800/80 border border-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-700/50 transition">
                        <i className={`fa-solid ${copySuccess ? 'fa-check' : 'fa-copy'}`}></i>
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-500 space-y-2 sm:space-y-0 w-full">
                    <span>Keep this key private. It controls your token usage and deployment billing.</span>
                    <button className="text-blue-400 font-semibold">Rotate Key</button>
                  </div>
                </div>
              </div>

            </div>

          {isProPayg && proWallet && (
            <div id="blue-pro-section" className="scroll-mt-24 pt-10 border-t border-purple-900/30">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-white">
                    <i className="fa-solid fa-bolt text-purple-400 mr-2"></i>
                    Blue Pro
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Credit usage and purchase history</p>
                </div>
                <a href="/blue-pro/checkout"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition text-sm">
                  <i className="fa-solid fa-cart-plus mr-2"></i>
                  Add Credits
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl glass border border-gray-800/80">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Blue Credits</span>
                  <p className="text-2xl font-extrabold text-white mt-1">{Number(proWallet.blue_credits || 0).toFixed(4)}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Available balance</p>
                </div>
                <div className="p-4 rounded-xl glass border border-gray-800/80">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Purchased</span>
                  <p className="text-2xl font-extrabold text-white mt-1">{Number(proWallet.total_purchased || 0).toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">All time</p>
                </div>
                <div className="p-4 rounded-xl glass border border-gray-800/80">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">30-Day Usage</span>
                  <p className="text-2xl font-extrabold text-white mt-1">{proUsage?.summary?.total_blue_credits_used?.toFixed(4) || "0.0000"}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{proUsage?.summary?.total_requests || 0} requests</p>
                </div>
              </div>

              <div className="flex gap-1.5 p-1 bg-gray-950 border border-gray-900/50 rounded-xl mb-6 max-w-sm">
                {(["overview", "purchases", "usage"] as const).map((tab) => (
                  <button key={tab} onClick={() => setProTab(tab)}
                    className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition ${
                      proTab === tab
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                        : "text-gray-400 hover:text-gray-200"
                    }`}>
                    {tab === "overview" ? "Overview" : tab === "purchases" ? "Purchases" : "Usage History"}
                  </button>
                ))}
              </div>

              {proTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl glass border border-gray-800/80">
                    <h4 className="text-xs font-bold text-gray-300 mb-3">Recent Purchases</h4>
                    {proTransactions.filter((t: any) => t.status === "completed" || t.status === "failed").length === 0 ? (
                      <p className="text-xs text-gray-500">No completed purchases yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {proTransactions.filter((t: any) => t.status === "completed" || t.status === "failed").slice(0, 5).map((txn: any) => (
                          <div key={txn.id} className="flex items-center justify-between py-1.5 border-b border-gray-800/40 last:border-0">
                            <div>
                              <p className="text-xs font-semibold text-gray-200">{txn.credits_purchased} Blue Credits</p>
                              <p className="text-[10px] text-gray-500">{new Date(txn.created_at).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              txn.status === "completed" ? "bg-green-950/60 text-green-400" : "bg-red-950/60 text-red-400"
                            }`}>{txn.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-5 rounded-xl glass border border-gray-800/80">
                    <h4 className="text-xs font-bold text-gray-300 mb-3">Usage by Model (30 days)</h4>
                    {!proUsage?.summary?.model_breakdown || Object.keys(proUsage.summary.model_breakdown).length === 0 ? (
                      <p className="text-xs text-gray-500">No usage recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(proUsage.summary.model_breakdown).map(([model, data]: [string, any]) => (
                          <div key={model} className="flex items-center justify-between py-1.5 border-b border-gray-800/40 last:border-0">
                            <div>
                              <p className="text-xs font-semibold text-gray-200">{model}</p>
                              <p className="text-[10px] text-gray-500">{data.requests} requests</p>
                            </div>
                            <span className="text-xs font-mono text-purple-400">{data.totalCost.toFixed(4)} credits</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {proTab === "purchases" && (
                <div className="rounded-xl glass border border-gray-800/80 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800/80">
                          <th className="text-left py-3 px-5 text-gray-400 font-semibold text-[10px] uppercase">Date</th>
                          <th className="text-right py-3 px-5 text-gray-400 font-semibold text-[10px] uppercase">Amount</th>
                          <th className="text-right py-3 px-5 text-gray-400 font-semibold text-[10px] uppercase">Credits</th>
                          <th className="text-right py-3 px-5 text-gray-400 font-semibold text-[10px] uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proTransactions.filter((t: any) => t.status === "completed" || t.status === "failed").length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-gray-500 text-xs">No purchases yet.</td></tr>
                        ) : proTransactions.filter((t: any) => t.status === "completed" || t.status === "failed").map((txn: any) => (
                          <tr key={txn.id} className="border-b border-gray-800/40 hover:bg-gray-900/30 transition">
                            <td className="py-3 px-5 text-gray-300 text-xs">{new Date(txn.created_at).toLocaleString()}</td>
                            <td className="py-3 px-5 text-right text-gray-300 text-xs">${Number(txn.amount_paid).toFixed(2)}</td>
                            <td className="py-3 px-5 text-right text-purple-400 font-mono text-xs">{Number(txn.credits_purchased).toFixed(2)}</td>
                            <td className="py-3 px-5 text-right">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                txn.status === "completed" ? "bg-green-950/60 text-green-400" : "bg-red-950/60 text-red-400"
                              }`}>{txn.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {proTab === "usage" && (
                <div className="rounded-xl glass border border-gray-800/80 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800/80">
                          <th className="text-left py-3 px-5 text-gray-400 font-semibold text-[10px] uppercase">Date</th>
                          <th className="text-left py-3 px-5 text-gray-400 font-semibold text-[10px] uppercase">Model</th>
                          <th className="text-right py-3 px-5 text-gray-400 font-semibold text-[10px] uppercase">Input</th>
                          <th className="text-right py-3 px-5 text-gray-400 font-semibold text-[10px] uppercase">Output</th>
                          <th className="text-right py-3 px-5 text-gray-400 font-semibold text-[10px] uppercase">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!proUsage?.usage || proUsage.usage.length === 0 ? (
                          <tr><td colSpan={5} className="py-8 text-center text-gray-500 text-xs">No usage recorded yet.</td></tr>
                        ) : proUsage.usage.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-900/30 transition">
                            <td className="py-3 px-5 text-gray-300 text-[10px]">{new Date(row.created_at).toLocaleString()}</td>
                            <td className="py-3 px-5 text-gray-200 text-[10px] font-semibold">{row.model}</td>
                            <td className="py-3 px-5 text-right text-gray-300 font-mono text-[10px]">{row.prompt_tokens?.toLocaleString() || 0}</td>
                            <td className="py-3 px-5 text-right text-gray-300 font-mono text-[10px]">{row.completion_tokens?.toLocaleString() || 0}</td>
                            <td className="py-3 px-5 text-right text-purple-400 font-mono text-[10px]">{Number(row.blue_credits_cost || row.cost || 0).toFixed(6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

            <div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Available Models Catalog</h3>
                  <p className="text-xs text-gray-500 mt-1">Blue Pro models organized by credit cost tier — from everyday coding to maximum intelligence.</p>
                </div>
                <span className={`mt-2 md:mt-0 text-xs px-2.5 py-1 rounded-full font-medium border ${
                  modelsLoading
                    ? 'bg-blue-950/40 border-blue-800/50 text-blue-400'
                    : modelsError
                      ? 'bg-red-950/40 border-red-800/50 text-red-400'
                      : 'bg-green-950/40 border-green-800/50 text-green-400'
                }`}>
                  {modelsLoading ? 'Loading Catalog' : modelsError ? 'Catalog Unavailable' : `${modelsList.length} Models Available`}
                </span>
              </div>

              <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center mb-6">
                <div className="flex flex-wrap gap-1.5 p-1 bg-gray-950 border border-gray-900/50 rounded-xl max-w-full overflow-x-auto">
                  {[
                    { id: "all", label: "All Models" },
                    { id: "Low Cost", label: "Low Cost" },
                    { id: "Standard", label: "Standard" },
                    { id: "High Cost", label: "High Cost" },
                    { id: "Premium", label: "Premium" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedCategory(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 whitespace-nowrap ${
                        selectedCategory === tab.id
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative md:w-64">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                    <i className="fa-solid fa-magnifying-glass text-xs"></i>
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search models..."
                    className="w-full bg-gray-900/50 border border-gray-800 rounded-xl py-2 pl-9 pr-4 text-xs text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                if (modelsLoading) {
                  return (
                    <div className="text-center py-12 rounded-2xl glass border border-gray-800/80 p-8">
                      <div className="w-8 h-8 rounded-full border-2 border-gray-800 border-t-blue-500 animate-spin mx-auto mb-3"></div>
                      <h4 className="text-sm font-semibold text-gray-300">Loading the model catalog</h4>
                      <p className="text-xs text-gray-500 mt-1">Fetching the latest models and pricing from the provider.</p>
                    </div>
                  );
                }

                if (modelsError) {
                  return (
                    <div className="text-center py-12 rounded-2xl glass border border-red-900/60 p-8">
                      <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-900/60 flex items-center justify-center mx-auto mb-3">
                        <i className="fa-solid fa-triangle-exclamation text-red-400"></i>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-200">The model catalog is temporarily unavailable</h4>
                      <p className="text-xs text-gray-500 mt-1">{modelsError}</p>
                      <button
                        onClick={() => void refreshModelCatalog(true)}
                        className="mt-4 px-4 py-1.5 rounded-lg border border-red-900/70 text-xs font-semibold text-red-300 hover:text-white hover:bg-red-950/50 transition"
                      >
                        Try Again
                      </button>
                    </div>
                  );
                }

                const catalogModels = modelsList.map(model => {
                  const inputCredits = Number(model.inputPrice || 0) * 1.5;
                  const outputCredits = Number(model.outputPrice || 0) * 1.5;
                  return {
                    ...model,
                    displayName: model.displayName || model.id,
                    description: model.description || "Available through the Blue OpenRouter gateway.",
                    inputCredits: inputCredits.toFixed(3),
                    outputCredits: outputCredits.toFixed(3),
                    tier: modelTier(inputCredits, outputCredits)
                  };
                });

                const filteredModels = catalogModels.filter((model) => {
                  const matchesCategory =
                    selectedCategory === "all" || model.tier === selectedCategory;
                  const matchesSearch =
                    model.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    model.description.toLowerCase().includes(searchQuery.toLowerCase());
                  return matchesCategory && matchesSearch;
                });

                if (filteredModels.length === 0) {
                  return (
                    <div className="text-center py-12 rounded-2xl glass border border-gray-800/80 p-8">
                      <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-3">
                        <i className="fa-solid fa-magnifying-glass text-gray-500"></i>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-300">No models match your search</h4>
                      <p className="text-xs text-gray-500 mt-1">Try clearing your search query or selecting a different tier tab.</p>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedCategory("all");
                        }}
                        className="mt-4 px-4 py-1.5 rounded-lg border border-gray-800 text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition"
                      >
                        Reset Filters
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredModels.map((model) => (
                      <div
                        key={model.id}
                        className="p-6 rounded-2xl glass border border-gray-800/80 hover:border-gray-700/80 hover:bg-gray-900/10 transition duration-300 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-4 mb-3">
                            <div>
                              <span className="text-md font-bold tracking-tight block text-gray-200">
                                {model.displayName}
                              </span>
                              <span className="text-[10px] font-mono text-gray-500 block mt-0.5">
                                {model.id}
                              </span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${TIER_BADGE_COLORS[model.tier] || "bg-gray-950/60 text-gray-400 border border-gray-800/60"}`}>
                              {model.tier}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed min-h-[40px]">
                            {model.description}
                          </p>
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-800/50 flex justify-between items-center text-xs">
                          <span className="text-gray-500">
                            Input: <strong className="text-gray-300 font-mono">{model.inputCredits} credits/1M</strong> • Output: <strong className="text-gray-300 font-mono">{model.outputCredits} credits/1M</strong>
                          </span>
                          <span className="text-green-400 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            Active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

          
        </div>
      )}

      </main>

      <footer className="w-full glass py-6 px-6 border-t border-gray-800/80 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
          <span>&copy; 2026 Blue AI. All rights reserved. Powered by Serverless Cloud Services.</span>
          <div className="flex space-x-4">
            <a href="#" className="hover:text-gray-400">Documentation</a>
            <a href="#" className="hover:text-gray-400">Support</a>
            <a href="#" className="hover:text-gray-400">Privacy Policy</a>
          </div>
        </div>
      </footer>
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030712]/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass border border-gray-800/80 p-6 shadow-2xl relative overflow-hidden transition-all duration-300 transform scale-100">
            {/* Colorful top strip */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${
              modalConfig.type === 'success' 
                ? 'from-green-500 to-emerald-500'
                : modalConfig.type === 'error'
                ? 'from-red-500 to-rose-500'
                : 'from-blue-500 to-indigo-500'
            }`}></div>

            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                modalConfig.type === 'success'
                  ? 'bg-green-950/40 border border-green-800/50 text-green-400 shadow-green-500/5'
                  : modalConfig.type === 'error'
                  ? 'bg-red-950/40 border border-red-800/50 text-red-400 shadow-red-500/5'
                  : 'bg-blue-950/40 border border-blue-800/50 text-blue-400 shadow-blue-500/5'
              }`}>
                <i className={`fa-solid ${
                  modalConfig.type === 'success'
                    ? 'fa-circle-check text-base'
                    : modalConfig.type === 'error'
                    ? 'fa-triangle-exclamation text-base'
                    : modalConfig.type === 'confirm'
                    ? 'fa-circle-question text-base'
                    : 'fa-circle-info text-base'
                }`}></i>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                  {modalConfig.title}
                </h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed font-medium">
                  {modalConfig.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-800/50 pt-4">
              {modalConfig.type === 'confirm' ? (
                <>
                  <button
                    onClick={modalConfig.onCancel}
                    className="px-4 py-2 rounded-xl border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={modalConfig.onConfirm}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] transition duration-200"
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] transition duration-200"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
