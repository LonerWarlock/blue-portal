"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function BlueProDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [packConfig, setPackConfig] = useState<any>({ priceUSD: 15, credits: 15 });
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "usage">("overview");
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (!session?.user) {
        sessionStorage.setItem("redirectAfterLogin", "/blue-pro/dashboard");
        router.push("/console");
        return;
      }
      setUser(session.user);
      loadData(session.user.id, session.access_token);
    });
  }, []);

  const loadData = async (userId: string, token: string) => {
    try {
      const walletRes = await fetch("/api/blue-pro/wallet", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (walletRes.status === 403) {
        router.push("/blue-pro");
        return;
      }
      const walletData = await walletRes.json();
      if (!walletRes.ok) throw new Error(walletData.error);
      setWallet(walletData);

      const txnRes = await fetch("/api/blue-pro/transactions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (txnRes.ok) {
        const txnData = await txnRes.json();
        setTransactions(txnData.transactions || []);
      }

      const packRes = await fetch("/api/blue-pro/pack-config");
      if (packRes.ok) {
        const packData = await packRes.json();
        setPackConfig(packData);
      }

      const usageRes = await fetch("/api/blue-pro/usage?days=30", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }
    } catch (err) {
      console.error("Failed to load Blue Pro data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCredits = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/blue-pro/buy-credits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push("/blue-pro/checkout");
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712]">
      <header className="w-full glass py-4 px-6 border-b border-gray-800/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <a href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <i className="fa-solid fa-bolt text-lg text-white"></i>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Blue Pro</span>
              <span className="text-xs block text-gray-500 font-medium">Pay As You Go</span>
            </div>
          </a>
          <nav className="flex items-center space-x-4">
            <a href="/console" className="text-sm text-gray-400 hover:text-gray-200 transition">Console</a>
            <a href="/blue-pro" className="text-sm text-gray-400 hover:text-gray-200 transition">About</a>
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button onClick={() => supabase.auth.signOut().then(() => router.push("/console"))}
              className="px-4 py-1.5 rounded-lg border border-gray-800 text-sm font-semibold hover:bg-gray-800/50 hover:text-white transition">
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Blue Pro Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Manage your credits and view usage</p>
          </div>
          <button
            onClick={handleBuyCredits}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition text-sm"
          >
            <i className="fa-solid fa-cart-plus mr-2"></i>
            Buy {packConfig.credits} Credits — ${packConfig.priceUSD}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-6 rounded-2xl glass border border-gray-800/80">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Blue Credits</span>
            <p className="text-3xl font-extrabold text-white mt-2">{wallet?.blue_credits?.toFixed(4) || "0.0000"}</p>
            <p className="text-xs text-gray-500 mt-1">Available balance</p>
          </div>
          <div className="p-6 rounded-2xl glass border border-gray-800/80">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Purchased</span>
            <p className="text-3xl font-extrabold text-white mt-2">{wallet?.total_purchased?.toFixed(2) || "0.00"}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>
          <div className="p-6 rounded-2xl glass border border-gray-800/80">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Used</span>
            <p className="text-3xl font-extrabold text-white mt-2">{wallet?.total_used?.toFixed(4) || "0.0000"}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>
          <div className="p-6 rounded-2xl glass border border-gray-800/80">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">30-Day Usage</span>
            <p className="text-3xl font-extrabold text-white mt-2">{usage?.summary?.total_blue_credits_used?.toFixed(4) || "0.0000"}</p>
            <p className="text-xs text-gray-500 mt-1">{usage?.summary?.total_requests || 0} requests</p>
          </div>
        </div>

        <div className="flex gap-1.5 p-1 bg-gray-950 border border-gray-900/50 rounded-xl mb-8 max-w-md">
          {(["overview", "transactions", "usage"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === tab
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab === "overview" ? "Overview" : tab === "transactions" ? "Purchases" : "Usage History"}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl glass border border-gray-800/80">
              <h3 className="text-sm font-bold text-gray-200 mb-4">Recent Purchases</h3>
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-500">No purchases yet.</p>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((txn: any) => (
                    <div key={txn.id} className="flex items-center justify-between py-2 border-b border-gray-800/40 last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-gray-200">
                          {txn.credits_purchased} Blue Credits
                        </p>
                        <p className="text-[10px] text-gray-500">{new Date(txn.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        txn.status === "completed" ? "bg-green-950/60 text-green-400" :
                        txn.status === "pending" ? "bg-yellow-950/60 text-yellow-400" :
                        "bg-red-950/60 text-red-400"
                      }`}>{txn.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 rounded-2xl glass border border-gray-800/80">
              <h3 className="text-sm font-bold text-gray-200 mb-4">Usage by Model (30 days)</h3>
              {!usage?.summary?.model_breakdown || Object.keys(usage.summary.model_breakdown).length === 0 ? (
                <p className="text-sm text-gray-500">No usage recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(usage.summary.model_breakdown).map(([model, data]: [string, any]) => (
                    <div key={model} className="flex items-center justify-between py-2 border-b border-gray-800/40 last:border-0">
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

        {activeTab === "transactions" && (
          <div className="rounded-2xl glass border border-gray-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800/80">
                    <th className="text-left py-4 px-6 text-gray-400 font-semibold text-xs uppercase">Date</th>
                    <th className="text-right py-4 px-6 text-gray-400 font-semibold text-xs uppercase">Amount</th>
                    <th className="text-right py-4 px-6 text-gray-400 font-semibold text-xs uppercase">Credits</th>
                    <th className="text-right py-4 px-6 text-gray-400 font-semibold text-xs uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-gray-500 text-sm">No transactions yet.</td></tr>
                  ) : transactions.map((txn: any) => (
                    <tr key={txn.id} className="border-b border-gray-800/40 hover:bg-gray-900/30 transition">
                      <td className="py-4 px-6 text-gray-300">{new Date(txn.created_at).toLocaleString()}</td>
                      <td className="py-4 px-6 text-right text-gray-300">${Number(txn.amount_paid).toFixed(2)}</td>
                      <td className="py-4 px-6 text-right text-purple-400 font-mono">{Number(txn.credits_purchased).toFixed(2)}</td>
                      <td className="py-4 px-6 text-right">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          txn.status === "completed" ? "bg-green-950/60 text-green-400" :
                          txn.status === "pending" ? "bg-yellow-950/60 text-yellow-400" :
                          "bg-red-950/60 text-red-400"
                        }`}>{txn.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "usage" && (
          <div className="rounded-2xl glass border border-gray-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800/80">
                    <th className="text-left py-4 px-6 text-gray-400 font-semibold text-xs uppercase">Date</th>
                    <th className="text-left py-4 px-6 text-gray-400 font-semibold text-xs uppercase">Model</th>
                    <th className="text-right py-4 px-6 text-gray-400 font-semibold text-xs uppercase">Input Tokens</th>
                    <th className="text-right py-4 px-6 text-gray-400 font-semibold text-xs uppercase">Output Tokens</th>
                    <th className="text-right py-4 px-6 text-gray-400 font-semibold text-xs uppercase">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {!usage?.usage || usage.usage.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-gray-500 text-sm">No usage recorded yet.</td></tr>
                  ) : usage.usage.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-900/30 transition">
                      <td className="py-4 px-6 text-gray-300 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="py-4 px-6 text-gray-200 text-xs font-semibold">{row.model}</td>
                      <td className="py-4 px-6 text-right text-gray-300 font-mono text-xs">{row.prompt_tokens?.toLocaleString() || 0}</td>
                      <td className="py-4 px-6 text-right text-gray-300 font-mono text-xs">{row.completion_tokens?.toLocaleString() || 0}</td>
                      <td className="py-4 px-6 text-right text-purple-400 font-mono text-xs">{Number(row.blue_credits_cost || row.cost || 0).toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
