'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import PageLayout from '@/app/components/PageLayout';
import TeamWorkspacePreview from '@/app/components/TeamWorkspacePreview';
import { BLUE_TEAMS_PLANS, BLUE_TEAMS_TEST_PRICE_INR, BLUE_TEAMS_TEST_PRICE_USD, type BlueTeamsTier } from '@/lib/blueTeamsPlans';
import type { getBlueTeamsCheckoutConfig } from '@/lib/blueTeamsCheckoutMode';
import styles from './teams.module.css';

type CheckoutConfig = ReturnType<typeof getBlueTeamsCheckoutConfig>;
const tiers: BlueTeamsTier[] = ['solo', 'pro', 'business'];

export default function TeamsClient({ checkout }: { checkout: CheckoutConfig }) {
  const { user, session } = useAuth();
  const router = useRouter();
  const [busyTier, setBusyTier] = useState<BlueTeamsTier | null>(null);
  const [error, setError] = useState('');
  const [paymentState, setPaymentState] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPaymentState(`${params.get('payment') || ''}:${params.get('test_mode') || ''}:${params.get('live_test') || ''}`);
  }, []);

  const choosePlan = async (tier: BlueTeamsTier) => {
    if (!checkout.checkoutEnabled || busyTier) return;
    if (!user) {
      sessionStorage.setItem('redirectAfterLogin', `/teams?tier=${tier}`);
      router.push('/console');
      return;
    }
    setBusyTier(tier);
    setError('');
    try {
      if (!session?.access_token) throw new Error('Please sign in again to continue.');
      const response = await fetch('/api/teams/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tier }),
      });
      const data = await response.json();
      if (!response.ok || !data.session_id) throw new Error(data.error || 'Could not start checkout. Please try again.');
      const returnUrl = `${window.location.origin}/teams`;
      window.location.href = `/checkout/teams?session_id=${encodeURIComponent(data.session_id)}&return_url=${encodeURIComponent(returnUrl)}`;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start checkout. Please try again.');
      setBusyTier(null);
    }
  };

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

          <div className={styles.grid}>
            {tiers.map((tier, index) => {
              const plan = BLUE_TEAMS_PLANS[tier];
              const featured = tier === 'pro';
              const testPrice = (checkout.testMode && tier === 'solo') || (checkout.liveTestPriceEnabled && tier === 'business');
              const inr = testPrice ? BLUE_TEAMS_TEST_PRICE_INR : plan.priceInr;
              const usd = testPrice ? BLUE_TEAMS_TEST_PRICE_USD : plan.priceUsd;
              return <article key={tier} className={`${styles.card} ${featured ? styles.featured : ''}`} style={{ '--card-order': index } as CSSProperties}>
                <div className={styles.cardTop}><div><p className={styles.tier}>{plan.name}</p><p className={styles.audience}>{plan.audience}</p></div>{featured && <span className={styles.recommended}>Best starting offer</span>}</div>
                <div className={styles.price}><span>₹{inr.toLocaleString('en-IN')}</span><small>/month</small></div>
                {checkout.paypalAvailable && <p className={styles.usdPrice}>or ${usd.toFixed(2)} USD · PayPal</p>}
                <ul className={styles.features}>
                  <li><Check size={15} aria-hidden="true" /><span>{plan.projectTeams} active project {plan.projectTeams === 1 ? 'team' : 'teams'}</span></li>
                  <li><Check size={15} aria-hidden="true" /><span>Up to {plan.agentsPerTeam} AI agents per team</span></li>
                  {plan.features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" /><span>{feature}</span></li>)}
                </ul>
                <button className={featured ? styles.primaryButton : styles.secondaryButton} type="button" onClick={() => void choosePlan(tier)} disabled={!checkout.checkoutEnabled || busyTier !== null}>
                  {busyTier === tier ? <>Starting checkout… <Loader2 size={16} className={styles.spinner} aria-hidden="true" /></>
                    : !checkout.checkoutEnabled ? 'Checkout not configured'
                      : <>{user ? `Choose ${plan.name}` : 'Sign in to choose'} <ArrowUpRight size={16} aria-hidden="true" /></>}
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
