"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MODELS } from "@/lib/models";

export default function ConsolePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [authError, setAuthError] = useState("");
  const [authStatusMessage, setAuthStatusMessage] = useState("");

  // Console State
  const [currentApiKey, setCurrentApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [balance, setBalance] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);

  // Model catalog search and category filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [modelsList, setModelsList] = useState<any[]>(Object.values(MODELS));

  useEffect(() => {
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
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;

      const walletRes = await fetch('/api/user/wallet', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const walletData = await walletRes.json();
      if (!walletRes.ok || walletData.error) throw new Error(walletData.error || 'Failed to load wallet');
      setBalance(walletData.balance);

      const keyRes = await fetch('/api/user/key', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const keyData = await keyRes.json();
      if (!keyRes.ok || keyData.error) throw new Error(keyData.error || 'Failed to load key');
      setCurrentApiKey(keyData.key);

      const modelsRes = await fetch('/api/models', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const modelsData = await modelsRes.json();
      if (modelsRes.ok && modelsData.models) {
        setModelsList(modelsData.models);
      }
    } catch (err) {
      console.error("Error loading user data:", err);
    }
  };

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

  const handleRotateKey = async () => {
    if (!confirm("Are you sure you want to rotate your API Key? The old key will stop working immediately inside your VS Code extension.")) {
      return;
    }

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
      alert("API key successfully rotated!");
    } catch (err: any) {
      setAuthStatusMessage("");
      alert("Error rotating API key: " + err.message);
    }
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
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400 font-medium hidden sm:inline">{user.email}</span>
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
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              <div className="lg:col-span-1 p-6 rounded-2xl glass relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Wallet Balance</span>
                  <span className="text-4xl font-extrabold tracking-tight mt-2 block bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    ${balance.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500 mt-1 block">Free Credits Tier</span>
                </div>
                <div className="mt-6 flex space-x-3">
                  <a
                    href="/subscribe"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-semibold text-white shadow-md hover:from-purple-500 hover:to-pink-500 transition duration-200 inline-flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-crown text-xs"></i>
                    Upgrade
                  </a>
                  <button className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-md hover:from-blue-500 hover:to-indigo-500 transition duration-200">
                    Add Credits
                  </button>
                  <button className="py-2.5 px-4 rounded-xl border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition">
                    History
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 p-6 rounded-2xl glass relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Your Blue API Key</span>
                  <p className="text-xs text-gray-500 mt-1">Copy this key and paste it into the VS Code Blue Extension auth screen to connect your workspace.</p>
                  
                  <div className="mt-4 flex items-center space-x-2">
                    <div className="relative flex-1">
                      <input 
                        type={apiKeyVisible ? "text" : "password"} 
                        readOnly 
                        value={currentApiKey} 
                        className="w-full bg-gray-950 border border-gray-800/80 rounded-xl py-3 px-4 text-xs font-mono text-indigo-300 focus:outline-none select-all"
                      />
                      <button 
                        onClick={() => setApiKeyVisible(!apiKeyVisible)} 
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
                      >
                        <i className={`fa-solid ${apiKeyVisible ? "fa-eye-slash" : "fa-eye"}`}></i>
                      </button>
                    </div>
                    <button 
                      onClick={handleCopyKey}
                      className="p-3 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50 text-gray-300 hover:text-white rounded-xl transition duration-200"
                    >
                      <i className={`fa-solid ${copySuccess ? "fa-check text-green-400" : "fa-copy"}`}></i>
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-500 space-y-2 sm:space-y-0 w-full">
                  <span>Keep this key private. It controls your token usage and deployment billing.</span>
                  <button onClick={handleRotateKey} className="text-blue-400 hover:text-blue-300 font-semibold transition">Rotate Key</button>
                </div>
              </div>

            </div>

            <div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Available Models Catalog</h3>
                  <p className="text-xs text-gray-500 mt-1">Blue supports standard free tier models alongside premium coding models.</p>
                </div>
                <span className="mt-2 md:mt-0 text-xs px-2.5 py-1 bg-green-950/40 border border-green-800/50 text-green-400 rounded-full font-medium">All Models Operational</span>
              </div>

              <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center mb-6">
                <div className="flex flex-wrap gap-1.5 p-1 bg-gray-950 border border-gray-900/50 rounded-xl max-w-full overflow-x-auto">
                  {[
                    { id: "all", label: "All Models" },
                    { id: "free", label: "Free Tier" },
                    { id: "claude", label: "Claude" },
                    { id: "gpt", label: "GPT-5" },
                    { id: "gemini", label: "Gemini" },
                    { id: "specialist", label: "Specialists" },
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
                const filteredModels = modelsList.filter((model) => {
                  const matchesCategory =
                    selectedCategory === "all" || model.category === selectedCategory;
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
                      <p className="text-xs text-gray-500 mt-1">Try clearing your search query or selecting a different category tab.</p>
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
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold font-mono whitespace-nowrap ${
                                model.isFree
                                  ? "bg-green-950/60 border border-green-900/60 text-green-400"
                                  : "bg-blue-950/60 border border-blue-900/60 text-blue-400"
                              }`}
                            >
                              {model.isFree ? "Free Tier" : "Premium"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed min-h-[40px]">
                            {model.description}
                          </p>
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-800/50 flex justify-between items-center text-xs">
                          <span className="text-gray-500">
                            Inputs: <strong className="text-gray-300 font-mono">${model.inputPrice}/1M</strong> • Outputs: <strong className="text-gray-300 font-mono">${model.outputPrice}/1M</strong>
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
    </>
  );
}
