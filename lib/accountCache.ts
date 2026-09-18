export const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
export const WALLET_CACHE_TTL_MS = 45 * 1000;

export interface AccountBootstrap {
  user_id: string;
  wallet: { balance: number };
  subscription: {
    plan: 'lite' | 'blue' | 'blue_pro';
    is_pro: boolean;
    discount: number;
    monthly_plan?: string;
    monthly_expires_at?: string | null;
    payg_account?: boolean;
  };
  blue_pro: any;
  pack_config?: any;
}

/** Per-provider, in-memory only: never persist API keys or tokens to browser storage. */
export class AccountCache {
  private accountId: string | null = null;
  private version = 0;
  private data: AccountBootstrap | null = null;
  private profileAt = 0;
  private walletAt = 0;
  private pending: Promise<AccountBootstrap> | null = null;
  private controller: AbortController | null = null;
  private fetcher: typeof fetch;
  private now: () => number;
  constructor(fetcher: typeof fetch = (...args) => fetch(...args), now = () => Date.now()) {
    this.fetcher = fetcher;
    this.now = now;
  }
  get generation() { return this.version; }
  peek() { return this.data; }
  setAccount(userId: string | null) {
    if (userId === this.accountId) return;
    this.invalidate();
    this.accountId = userId;
    this.data = null;
  }
  invalidate() {
    this.version++;
    this.controller?.abort();
    this.pending = null;
    this.controller = null;
    this.profileAt = 0;
    this.walletAt = 0;
  }
  async get(token: string, force = false): Promise<AccountBootstrap> {
    if (!this.accountId || !token) throw new Error('Sign in to load your account.');
    const full = force || !this.data || this.now() - this.profileAt >= PROFILE_CACHE_TTL_MS;
    if (!full && this.now() - this.walletAt < WALLET_CACHE_TTL_MS) return this.data!;
    if (this.pending) return this.pending;
    const version = this.version;
    const userId = this.accountId;
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const request = (async () => {
      const response = await this.fetcher(full ? '/api/me/bootstrap' : '/api/me/bootstrap?scope=wallet', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Account service temporarily unavailable.');
      if (payload?.user_id !== userId || !['lite', 'blue', 'blue_pro'].includes(payload?.subscription?.plan)
        || !Number.isFinite(Number(payload?.wallet?.balance))) throw new Error('Invalid account response.');
      if (this.version !== version || this.accountId !== userId) throw new Error('Account changed while loading.');
      this.data = full ? payload : {
        ...this.data!, wallet: payload.wallet, subscription: payload.subscription,
        blue_pro: payload.blue_pro ? { ...this.data?.blue_pro, ...payload.blue_pro } : null,
      };
      const loadedAt = this.now();
      if (full) this.profileAt = loadedAt;
      this.walletAt = loadedAt;
      return this.data!;
    })();
    this.pending = request;
    try { return await request; }
    finally {
      clearTimeout(timeout);
      if (this.pending === request) { this.pending = null; this.controller = null; }
    }
  }
}
