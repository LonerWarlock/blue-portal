'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import PageLayout from '@/app/components/PageLayout';
import TeamWorkspacePreview from '@/app/components/TeamWorkspacePreview';
import { BLUE_TEAMS_PLANS, BLUE_TEAMS_TEST_PRICE_INR, BLUE_TEAMS_TEST_PRICE_USD, isBlueTeamsTier, type BlueTeamsTier } from '@/lib/blueTeamsPlans';
import type { getBlueTeamsCheckoutConfig } from '@/lib/blueTeamsCheckoutMode';
import { activeBlueTeamsEntitlement } from '@/lib/blueTeamsEntitlement';
import styles from './teams.module.css';

type CheckoutConfig = ReturnType<typeof getBlueTeamsCheckoutConfig>;
const tiers: BlueTeamsTier[] = ['solo', 'pro', 'business'];

export default function TeamsClient({ checkout }: { checkout: CheckoutConfig }) {
  const { user, session, loading, account, accountLoading, accountError, invalidateAccount } = useAuth();
  const router = useRouter();
  const [busyTier, setBusyTier] = useState<BlueTeamsTier | null>(null);
  const [error, setError] = useState('');
  const [paymentState, setPaymentState] = useState('');
  const [changingPlan, setChangingPlan] = useState(false);
  const [planNotice, setPlanNotice] = useState('');
  const resumedCheckout = useRef(false);
  const accountIdentity = useRef(user?.id); accountIdentity.current = user?.id;
  const [planClock, setPlanClock] = useState(() => Date.now());
  // Use the shared, server-verified account snapshot. Never infer access from
  // a payment return URL, local storage, the regular Blue plan or a former user.
  const teamsUnavailable = Boolean(user?.id && account && account.user_id === user.id && (!account.teams || account.teams.available === false));
  const accountReady = Boolean(user?.id && account?.user_id === user.id && !loading && !accountLoading && !accountError && !teamsUnavailable);
  const activeTeams = activeBlueTeamsEntitlement(accountReady ? account?.teams : null, Math.max(planClock, Date.now()));
  const activeTier = activeTeams.plan;
  const expiry = activeTeams.current_period_end;
  const savedChange = accountReady ? account?.teams?.scheduled_change : null;
  const scheduledChange = savedChange && isBlueTeamsTier(savedChange.plan) && typeof savedChange.change_at === 'string'
    && Number.isFinite(new Date(savedChange.change_at).getTime()) && savedChange.payment_required === true ? savedChange : null;
  const chosenPlanDue = Boolean(scheduledChange && !activeTier && new Date(scheduledChange.change_at).getTime() <= Math.max(planClock, Date.now()));
  const checkingPlan = Boolean(loading || user && (!accountReady && !accountError && !teamsUnavailable));

  useEffect(() => {
    resumedCheckout.current = false;
    setBusyTier(null); setChangingPlan(false); setError(''); setPlanNotice('');
  }, [user?.id]);
  useEffect(() => {
    const nextChange = expiry || scheduledChange?.change_at;
    if (!nextChange || new Date(nextChange).getTime() <= Date.now()) return;
    const timer = window.setTimeout(() => setPlanClock(Date.now()), Math.min(Math.max(new Date(nextChange).getTime() - Date.now() + 1, 1), 86_400_000));
    return () => window.clearTimeout(timer);
  }, [expiry, scheduledChange?.change_at, planClock]);

  const changeAtExpiry = async (tier: BlueTeamsTier | null) => {
    if (!user?.id || !session?.access_token || !accountReady || busyTier || changingPlan) return;
    const checkoutOwner = user.id;
    setChangingPlan(true); setBusyTier(tier); setError(''); setPlanNotice('');
    try {
      const response = await fetch('/api/teams/plan-change', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tier }),
      });
      const data = await response.json();
      if (accountIdentity.current !== checkoutOwner) return;
      if (!response.ok) throw new Error(data.error || 'Could not update your plan change. Please try again.');
      await invalidateAccount();
      if (accountIdentity.current === checkoutOwner) setPlanNotice(tier ? 'Plan change saved for the end of your current access. Payment will be required to start the new plan; you will not be charged automatically.' : 'Your scheduled plan change was cancelled. Your current access is unchanged.');
    } catch (cause) {
      if (accountIdentity.current === checkoutOwner) setError(cause instanceof Error ? cause.message : 'Could not update your plan change. Please try again.');
    } finally {
      if (accountIdentity.current === checkoutOwner) { setChangingPlan(false); setBusyTier(null); }
    }
  };

  const choosePlan = async (tier: BlueTeamsTier) => {
    if (busyTier || changingPlan || loading || user && !accountReady) return;
    if (activeTier && tiers.indexOf(tier) < tiers.indexOf(activeTier)) {
      await changeAtExpiry(tier);
      return;
    }
    if (!checkout.checkoutEnabled) return;
    if (!user) {
      // Console completes sign-in, then this page resumes directly into the
      // selected checkout rather than asking the person to choose again.
      sessionStorage.setItem('redirectAfterLogin', `/teams?checkout=${tier}`);
      router.push('/console');
      return;
    }
    setBusyTier(tier);
    setError(''); setPlanNotice('');
    const checkoutOwner = user.id;
    try {
      if (!session?.access_token) throw new Error('Please sign in again to continue.');
      const response = await fetch('/api/teams/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tier }),
      });
      const data = await response.json();
      if (accountIdentity.current !== checkoutOwner) return;
      if (!response.ok || !data.session_id) throw new Error(data.error || 'Could not start checkout. Please try again.');
      const returnUrl = `${window.location.origin}/console`;
      window.location.href = `/checkout/teams?session_id=${encodeURIComponent(data.session_id)}&return_url=${encodeURIComponent(returnUrl)}`;
    } catch (cause) {
      if (accountIdentity.current !== checkoutOwner) return;
      setError(cause instanceof Error ? cause.message : 'Could not start checkout. Please try again.');
      setBusyTier(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPaymentState(`${params.get('payment') || ''}:${params.get('test_mode') || ''}:${params.get('live_test') || ''}`);
    const tier = params.get('checkout');
    if (!resumedCheckout.current && user && session?.access_token && accountReady && isBlueTeamsTier(tier)) {
      resumedCheckout.current = true;
      void choosePlan(tier);
    }
  }, [session?.access_token, user, accountReady]);

  const [payment, testFlag, liveTestFlag] = paymentState.split(':');
  return <PageLayout>
    <section className={styles.page}>
      <div className={styles.container}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}><Sparkles size={14} aria-hidden="true" /> Blue Teams</p>
          <h1>Your team.<br /><span>Working together.</span></h1>
          <p className={styles.lede}>Give Blue a goal. It organizes the work, assigns specialists and keeps each project’s progress together—so you can focus on the outcome.</p>
          <Link href="#plans" className={styles.heroCta}>Choose your team plan <ArrowRight size={16} aria-hidden="true" /></Link>
        </header>

        {payment === 'success' && <div className={styles.notice} role="status">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>{testFlag === '1'
            ? 'Sandbox payment succeeded. No real payment was charged; this test purchase does not grant Blue Desktop access.'
            : liveTestFlag === '1'
              ? '₹1 live launch payment confirmed. Your Business Blue Teams plan has been recorded.'
              : 'Payment confirmed. Your Blue Teams plan has been recorded.'}</p>
        </div>}
        {payment === 'pending' && <div className={styles.notice} role="status"><ShieldCheck size={18} aria-hidden="true" /><p>Payment was received and is being confirmed. Please don’t pay again; refresh this page in a moment.</p></div>}
        {payment === 'failed' && <p className={styles.error} role="alert">Payment was not completed. You can safely try again.</p>}
        {payment === 'cancelled' && <p className={styles.info} role="status">Checkout was cancelled; no payment was taken.</p>}

        {checkout.testMode && <div className={styles.testBanner} role="status">
          <strong>Sandbox testing is on.</strong> Solo is ₹{BLUE_TEAMS_TEST_PRICE_INR} / ${BLUE_TEAMS_TEST_PRICE_USD.toFixed(2)} for test payments only. PayPal and PayU are configured for their test environments; this does not charge real money or unlock Blue Desktop.
        </div>}
        {checkout.liveTestPriceEnabled && <div className={styles.testBanner} role="status">
          <strong>Temporary live launch test.</strong> Business is ₹{BLUE_TEAMS_TEST_PRICE_INR} / ${BLUE_TEAMS_TEST_PRICE_USD.toFixed(2)} for a real production payment. The regular Business price returns when this launch test ends.
        </div>}

        <section className={styles.previewSection} aria-labelledby="preview-title">
          <div className={styles.previewCopy}>
            <p className={styles.eyebrow}>One organized workspace</p>
            <h2 id="preview-title">A team that moves the work forward.</h2>
            <p>Blue can coordinate specialist agents, keep their project work separate, and bring you in when a decision or approval is needed.</p>
            <p className={styles.computerNote}>Blue Teams runs on your computer. Keep Blue open and your computer turned on while work is running; work pauses if the app or computer stops.</p>
          </div>
          <TeamWorkspacePreview variant="pricing" />
        </section>

        <section id="plans" className={styles.plansSection} aria-labelledby="plans-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Plans for every team size</p><h2 id="plans-title">Pick the capacity you need.</h2></div>
            <p>Monthly prepaid access. No auto-renewal or automatic repeat charges.</p>
          </div>

          {checkingPlan && <p className={styles.info} role="status">Checking your Teams plan…</p>}
          {user && (accountError || teamsUnavailable) && <div className={styles.error} role="alert"><p>Your Teams plan could not be verified. Checkout is paused until your current access can be checked. <button type="button" onClick={() => void invalidateAccount()}>Retry account refresh</button></p></div>}
          {accountReady && activeTier && expiry && <section className={styles.notice} aria-label="Your active Blue Teams plan">
            <ShieldCheck size={18} aria-hidden="true" /><div><strong>Teams {BLUE_TEAMS_PLANS[activeTier].name} is active</strong><p>Access until <time dateTime={expiry}>{new Date(expiry).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</time>.</p><p>{activeTeams.active_project_teams} active project {activeTeams.active_project_teams === 1 ? 'team' : 'teams'} · Up to {activeTeams.agents_per_team} agents per team.</p><p>Prepaid access, with no auto-renewal. Renew the same plan to add another 30 days.</p><p>Upgrades take effect after payment and charge the remaining-period price difference shown at checkout. A lower plan can be scheduled for expiry; you pay to start it, with no automatic charge.</p><button type="button" onClick={() => void invalidateAccount()}>Refresh plan</button></div>
          </section>}
          {scheduledChange && <section className={styles.info} aria-label="Scheduled Teams plan change"><div><strong>{chosenPlanDue ? `Chosen next plan: Teams ${BLUE_TEAMS_PLANS[scheduledChange.plan].name} — payment required` : `Teams ${BLUE_TEAMS_PLANS[scheduledChange.plan].name} is scheduled`}</strong><p>{chosenPlanDue ? 'The selected change date was ' : 'From '}<time dateTime={scheduledChange.change_at}>{new Date(scheduledChange.change_at).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</time>. Payment is required to start this prepaid plan; there is no automatic charge.</p>{chosenPlanDue && <><p>Your previous Teams access has expired. The chosen plan does not become active until you complete payment.</p><button type="button" disabled={!checkout.checkoutEnabled || changingPlan || busyTier !== null} onClick={() => void choosePlan(scheduledChange.plan)}>{busyTier === scheduledChange.plan ? 'Starting checkout…' : `Complete ${BLUE_TEAMS_PLANS[scheduledChange.plan].name} checkout`}</button>{' '}</>}<button type="button" disabled={changingPlan || busyTier !== null} onClick={() => void changeAtExpiry(null)}>{changingPlan ? 'Updating change…' : 'Cancel scheduled change'}</button></div></section>}
          {planNotice && <p className={styles.info} role="status">{planNotice}</p>}
          {accountReady && !activeTier && <p className={styles.info} role="status">No active Blue Teams plan. Your regular Blue plan and credits are separate.</p>}

          <div className={styles.grid}>
            {tiers.map((tier, index) => {
              const plan = BLUE_TEAMS_PLANS[tier];
              const featured = tier === 'pro';
              const current = accountReady && activeTier === tier;
              const downgrade = Boolean(activeTier && tiers.indexOf(tier) < tiers.indexOf(activeTier));
              const upgrade = Boolean(activeTier && tiers.indexOf(tier) > tiers.indexOf(activeTier));
              const testPrice = (checkout.testMode && tier === 'solo') || (checkout.liveTestPriceEnabled && tier === 'business');
              const inr = testPrice ? BLUE_TEAMS_TEST_PRICE_INR : plan.priceInr;
              const usd = testPrice ? BLUE_TEAMS_TEST_PRICE_USD : plan.priceUsd;
              return <article key={tier} aria-label={`Teams ${plan.name}`} className={`${styles.card} ${featured ? styles.featured : ''}`} style={{ '--card-order': index } as CSSProperties}>
                <div className={styles.cardTop}><div><p className={styles.tier}>{plan.name}</p><p className={styles.audience}>{plan.audience}</p></div>{current ? <span className={styles.recommended}>Current plan</span> : featured && <span className={styles.recommended}>Best starting offer</span>}</div>
                <div className={styles.price}><span>₹{inr.toLocaleString('en-IN')}</span><small>/month</small></div>
                {checkout.paypalAvailable && <p className={styles.usdPrice}>or ${usd.toFixed(2)} USD · PayPal</p>}
                <ul className={styles.features}>
                  <li><Check size={15} aria-hidden="true" /><span>{plan.projectTeams} active project {plan.projectTeams === 1 ? 'team' : 'teams'}</span></li>
                  <li><Check size={15} aria-hidden="true" /><span>Up to {plan.agentsPerTeam} AI agents per team</span></li>
                  {plan.features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" /><span>{feature}</span></li>)}
                </ul>
                <button className={featured ? styles.primaryButton : styles.secondaryButton} type="button" onClick={() => void choosePlan(tier)} disabled={(!checkout.checkoutEnabled && !downgrade) || busyTier !== null || changingPlan || loading || Boolean(user && !accountReady)}>
                  {busyTier === tier ? <>{changingPlan ? 'Saving plan change…' : 'Starting checkout…'} <Loader2 size={16} className={styles.spinner} aria-hidden="true" /></>
                    : !checkout.checkoutEnabled && !downgrade ? 'Checkout not configured'
                      : <>{loading ? 'Checking sign-in…' : user && !accountReady ? checkingPlan ? 'Checking your plan…' : 'Plan unavailable' : user ? current ? `Renew ${plan.name}` : downgrade ? `Change to ${plan.name} at expiry` : upgrade ? `Upgrade to ${plan.name}` : `Choose ${plan.name}` : 'Sign in to choose'} <ArrowUpRight size={16} aria-hidden="true" /></>}
                </button>
              </article>;
            })}
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {!checkout.checkoutEnabled && <p className={styles.disabledNotice}>Payments are not enabled on this deployment. Sandbox checkout requires both gateways’ test credentials; live checkout remains off until Blue Desktop plan access is released.</p>}
          <div className={styles.terms}><p>Prices are prepaid for 30 days and do not automatically renew. PayPal charges in USD and is intended for international payments; PayU handles INR payments.</p><p>Task execution happens locally: keep Blue open and the computer on while work is running. If Blue or the computer closes, active work pauses and can resume when Blue starts again.</p></div>
        </section>

        <p className={styles.legal}>By purchasing, you agree to the <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/refund">Refund Policy</Link>.</p>
      </div>
    </section>
  </PageLayout>;
}
