/** Effective access, not purchase history. Empty PAYG wallets fall back to Lite. */
export function effectiveAccountPlan(
  wallet: { account_type?: unknown; blue_credits?: unknown } | null,
  profile: { status?: unknown } | null,
  subscription: { plan?: unknown; status?: unknown; current_period_end?: unknown } | null,
  now = Date.now(),
): { plan: 'lite' | 'blue' | 'blue_pro'; is_pro: boolean; monthly_plan: 'lite' | 'blue'; monthly_expires_at: string | null; payg_account: boolean } {
  const expiry = subscription?.current_period_end;
  const expiryTime = expiry ? Date.parse(String(expiry)) : undefined;
  const monthlyActive = subscription?.status === 'active'
    && String(subscription.plan || '').trim().toLowerCase() === 'blue'
    && (expiryTime === undefined || (Number.isFinite(expiryTime) && expiryTime > now));
  const credits = Number(wallet?.blue_credits || 0);
  const paygAccount = wallet?.account_type === 'pro_payg' && profile?.status === 'active';
  const proActive = paygAccount && Number.isFinite(credits) && credits > 0;
  return {
    plan: proActive ? 'blue_pro' : monthlyActive ? 'blue' : 'lite',
    is_pro: proActive,
    monthly_plan: monthlyActive ? 'blue' : 'lite',
    monthly_expires_at: monthlyActive && expiry ? String(expiry) : null,
    payg_account: paygAccount,
  };
}
