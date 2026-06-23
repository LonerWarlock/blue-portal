"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MODELS } from "@/lib/models";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
    // Load rememberMe preference
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('blue_remember_me');
      if (saved !== null) {
        setRememberMe(saved === 'true');
      }
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

  // Load balance and API keys from backend APIs securely (bypasses RLS issues)
  const loadUserData = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;

      // 1. Fetch Wallet Balance from server API
      const walletRes = await fetch('/api/user/wallet', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const walletData = await walletRes.json();
      if (!walletRes.ok || walletData.error) throw new Error(walletData.error || 'Failed to load wallet');
      setBalance(walletData.balance);

      // 2. Fetch API Key from server API
      const keyRes = await fetch('/api/user/key', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const keyData = await keyRes.json();
      if (!keyRes.ok || keyData.error) throw new Error(keyData.error || 'Failed to load key');
      setCurrentApiKey(keyData.key);

      // 3. Fetch live models catalog (updates the catalog in real-time)
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

  // Handle sending OTP email
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthStatusMessage("");

    if (!email) {
      setAuthError("Please enter your email address.");
      return;
    }

    try {
      if (supabase.isMock) {
        // Demo mode mock flow
        setAuthStatusMessage("Demo Mode: Sending login code to your email...");
        setTimeout(() => {
          setOtpSent(true);
          setAuthStatusMessage("Demo Mode: Login code sent! Use code 123456 to sign in.");
        }, 800);
        return;
      }

      // Live custom SMTP OTP API flow
      setAuthStatusMessage("Sending login code...");
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to send verification code.');
      }

      // Save 'rememberMe' selection so the custom storage adapter knows what to use when session is verified
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('blue_remember_me', rememberMe ? 'true' : 'false');
      }

      setOtpSent(true);
      setAuthStatusMessage("Login code sent to your email! Please check your inbox.");
    } catch (err: any) {
      setAuthError(err.message || "Failed to send verification code. Please check your credentials or network.");
      setAuthStatusMessage("");
    }
  };

  // Handle OTP verification submit
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthStatusMessage("");

    if (!otpCode || otpCode.length !== 6) {
      setAuthError("Please enter a valid 6-digit verification code.");
      return;
    }

    try {
      if (supabase.isMock) {
        // Demo mode verification mock flow
        if (otpCode !== "123456") {
          setAuthError("Invalid code. Please enter 123456 in Demo Mode.");
          return;
        }
        
        setAuthStatusMessage("Logging in...");
        setTimeout(() => {
          const demoUser = { id: "demo_user_123456", email: email };
          setUser(demoUser);
          setCurrentApiKey("blue_demo_key_abcdef123456");
          setBalance(1.00);
          setAuthStatusMessage("");
        }, 500);
        return;
      }

      // Save 'rememberMe' selection again to ensure consistency
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('blue_remember_me', rememberMe ? 'true' : 'false');
      }

      // Live custom SMTP verification API flow
      setAuthStatusMessage("Verifying code...");
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: otpCode }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Invalid or expired code.');
      }

      const { session } = data;
      
      // Establish user session in client-side Supabase client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      if (sessionError) throw sessionError;

      setUser(session.user);
      await loadUserData(session.user.id);
      setAuthStatusMessage("");
    } catch (err: any) {
      setAuthError(err.message || "Incorrect verification code. Please check your email and try again.");
      setAuthStatusMessage("");
    }
  };

  const handleResetAuthForm = () => {
    setOtpSent(false);
    setOtpCode("");
    setAuthError("");
    setAuthStatusMessage("");
  };

  // Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Handle Copy Key to Clipboard
  const handleCopyKey = () => {
    navigator.clipboard.writeText(currentApiKey).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1500);
    });
  };

  // Handle Key Rotation securely via server API (bypasses RLS issues)
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
      {/* Header */}
      <header className="w-full glass py-4 px-6 border-b border-gray-800/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <i className="fa-solid fa-robot text-lg text-white"></i>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Blue AI</span>
              <span className="text-xs block text-gray-500 font-medium">Developer Console</span>
            </div>
          </div>
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
        {/* Supabase configuration warning banner */}
        {supabase.isMock && (
          <div className="w-full max-w-md mb-8 p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl text-amber-300 text-sm text-center flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>Supabase Credentials Not Configured</span>
            </div>
            <p className="text-xs text-amber-400/85">
              The portal is running in <strong>Demo Mode</strong>. Please create a <code>.env.local</code> file in <code>d:\blue-portal</code> with your Supabase credentials to enable auth, database persistence, and API keys.
            </p>
          </div>
        )}

        {/* AUTHENTICATION CARD */}
        {!user ? (
          <div className="w-full max-w-md p-8 rounded-2xl glass shadow-2xl relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight">
                {otpSent ? "Verify login code" : "Welcome back"}
              </h2>
              <p className="text-sm text-gray-400 mt-2">
                {otpSent ? `We sent a 6-digit verification code to ${email}` : "Sign in securely with email OTP"}
              </p>
            </div>

            {!otpSent ? (
              <form onSubmit={handleAuthSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500"><i className="fa-solid fa-envelope"></i></span>
                    <input 
                      type="email" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" 
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="remember_me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded bg-gray-900/50 border-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-950 transition cursor-pointer"
                  />
                  <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-400 select-none cursor-pointer hover:text-gray-300">
                    Remember me on this device
                  </label>
                </div>

                <button type="submit" className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200">
                  Send Login Code
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">6-Digit Verification Code</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500"><i className="fa-solid fa-key"></i></span>
                    <input 
                      type="text" 
                      required 
                      maxLength={6}
                      pattern="\d{6}"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-gray-900/50 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition tracking-[0.25em] font-mono text-center text-lg" 
                      placeholder="000000"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition duration-200">
                  Verify & Sign In
                </button>

                <div className="text-center mt-4">
                  <button 
                    type="button"
                    onClick={handleResetAuthForm}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold focus:outline-none"
                  >
                    <i className="fa-solid fa-arrow-left mr-1"></i> Change email address
                  </button>
                </div>
              </form>
            )}

            {authStatusMessage && (
              <div className="mt-4 p-3 bg-blue-950/40 border border-blue-800/80 rounded-xl text-blue-400 text-xs text-center font-medium">
                {authStatusMessage}
              </div>
            )}

            {authError && (
              <div className="mt-4 p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-red-400 text-xs text-center font-medium">
                {authError}
              </div>
            )}
          </div>
        ) : (
          
          /* CONSOLE PANEL */
          <div className="w-full space-y-10">
            
            {/* Key & Wallet Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Wallet Card */}
              <div className="lg:col-span-1 p-6 rounded-2xl glass relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Wallet Balance</span>
                  <span className="text-4xl font-extrabold tracking-tight mt-2 block bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    ${balance.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500 mt-1 block">Free Credits Tier</span>
                </div>
                <div className="mt-6 flex space-x-3">
                  <button className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-md hover:from-blue-500 hover:to-indigo-500 transition duration-200">
                    Add Credits
                  </button>
                  <button className="py-2.5 px-4 rounded-xl border border-gray-800 text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800/50 transition">
                    History
                  </button>
                </div>
              </div>

              {/* API Key Manager */}
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

            {/* Model Showcase */}
            <div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Available Models Catalog</h3>
                  <p className="text-xs text-gray-500 mt-1">Blue supports standard free tier models alongside premium coding models.</p>
                </div>
                <span className="mt-2 md:mt-0 text-xs px-2.5 py-1 bg-green-950/40 border border-green-800/50 text-green-400 rounded-full font-medium">All Models Operational</span>
              </div>

              {/* Filters & Search Control Bar */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center mb-6">
                {/* Category tabs */}
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

                {/* Search bar */}
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

              {/* Dynamic Catalog Grid */}
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

      {/* Footer */}
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
