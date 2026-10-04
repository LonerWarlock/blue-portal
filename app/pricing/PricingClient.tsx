"use client";

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Check, ChevronDown, GraduationCap, Loader2, Plus, Sparkles } from 'lucide-react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import PageLayout from '@/app/components/PageLayout';
import ClaimCouponModal from '@/app/components/ClaimCouponModal';
import SpotlightCard from '@/app/components/react-bits/SpotlightCard';
import StarBorder from '@/app/components/react-bits/StarBorder';
import BillingCycleSelector from './BillingCycleSelector';
import { BLUE_SUBSCRIPTION_PLANS, isBlueBillingCycle, type BlueBillingCycle } from '@/lib/blueSubscriptionPlans';
import styles from './pricing.module.css';

const allFeatures = ['AI Chat', 'Code Autocomplete', 'Codebase Search', 'Syntax Checking', 'Cloud Models', 'Local Models',
  'Multi-Agent Teams', 'Figma-to-Code', 'GitHub Integration', 'Vercel Integration', 'Canva Integration', 'Web Search',
  'Premium UI Creation', 'Premium Models'];

const plans = [
  { id: 'lite', name: 'Blue Lite', description: 'Start your next idea. For free.',
    benefitsTitle: 'Your everyday coding tools', benefits: ['AI chat & code autocomplete', 'Codebase search & syntax checks', 'Cloud & local models'],
    features: [true, true, true, true, true, true, false, false, false, false, false, false, false, false] },
  { id: 'blue', name: 'Blue', description: 'More power for the way you build.',
    benefitsTitle: 'Everything in Lite, plus', benefits: ['Multi-agent teams & Figma-to-Code', 'GitHub, Vercel & Canva integrations', 'Web search & premium UI creation'],
    features: [true, true, true, true, true, true, true, true, true, true, true, true, true, false] },
  { id: 'blue_pro', name: 'Blue Pro', description: 'Premium models. On your terms.',
    benefitsTitle: 'Everything in Blue, plus', benefits: ['Selected Premium Models', 'Credits that never expire', '₹1,500 full-access pack available'],
    features: [true, true, true, true, true, true, true, true, true, true, true, true, true, true] },
] as const;

export default function PricingClient() {
  const { user, session, account, accountLoading, accountError, invalidateAccount } = useAuth();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');
  const [billingCycle, setBillingCycle] = useState<BlueBillingCycle>('monthly');
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const bluePlan = BLUE_SUBSCRIPTION_PLANS[billingCycle];
  const activePlan = account?.subscription.plan || 'lite';
  const imrBalance = Number(account?.wallet.balance || 0);

  useEffect(() => {
    const cycle = new URLSearchParams(window.location.search).get('billing_cycle');
    if (isBlueBillingCycle(cycle)) setBillingCycle(cycle);
  }, []);

  const handleSubscribe = async () => {
    if (!user) {
      sessionStorage.setItem('redirectAfterLogin', `/pricing?billing_cycle=${billingCycle}`);
      router.push('/console');
      return;
    }
    setSubscribing(true);
    setSubscribeError('');
    try {
      const token = session?.access_token;
      if (!token) throw new Error('Please sign in again to continue.');
      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: 'blue', billing_cycle: billingCycle }),
      });
      const data = await res.json();
      if (!res.ok || !data.session_id) throw new Error(data.error || 'Could not start checkout. Please try again.');
      const returnUrl = `${window.location.origin}/console`;
      window.location.href = `/checkout/blue?session_id=${data.session_id}&return_url=${encodeURIComponent(returnUrl)}`;
    } catch (error) {
      setSubscribeError(error instanceof Error ? error.message : 'Could not start checkout. Please try again.');
      setSubscribing(false);
    }
  };

  return <PageLayout><MotionConfig reducedMotion="user">
    <section className={styles.page} aria-labelledby="pricing-title">
      <div className={styles.container}>
        <header className={styles.intro}>
          <div className={styles.kicker}><span>Pricing</span><span className={styles.kickerRule} /><GraduationCap size={15} aria-hidden="true" /> Made specifically for students</div>
          <h1 id="pricing-title" className={styles.title}>Build more. <span>Spend less.</span></h1>
          <p className={styles.introCopy}>From your first project to your next big launch. Choose your way to build.</p>
        </header>

        {accountLoading && user && !account && <p role="status" className={styles.accountMessage}>Loading your plan…</p>}
        {accountError && <p role="alert" className={styles.error}>{accountError} <button type="button" onClick={() => void invalidateAccount()}>Retry</button></p>}

        <div className={styles.grid}>
          {plans.map((plan, index) => {
            const featured = plan.id === 'blue';
            const current = Boolean(user && account && activePlan === plan.id);
            const card = <SpotlightCard className={`${styles.card} ${featured ? styles.featuredCard : styles.secondaryCard}`}
              spotlightColor={featured ? 'rgba(114, 179, 255, 0.2)' : 'rgba(94, 137, 245, 0.1)'}>
              <div className={styles.planName}><h2>{plan.name}</h2>
                {featured ? <span className={styles.popular}>{current ? <Check size={11} aria-hidden="true" /> : <Sparkles size={11} aria-hidden="true" />}{current ? 'Current Plan' : 'Popular choice'}</span>
                  : current && <span className={styles.current}><Check size={11} aria-hidden="true" /> Current Plan</span>}
              </div>
              <p className={styles.description}>{plan.description}</p>

              <div className={styles.priceBlock}>
                {featured ? <div aria-live="polite" aria-atomic="true">
                  <div className={styles.priceLine}>
                    <motion.span key={billingCycle} className={styles.price} initial={reducedMotion ? false : { opacity: .4, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}>
                      <span className={styles.currency}>₹</span>{bluePlan.priceInr.toLocaleString('en-IN')}
                    </motion.span><span className={styles.period}>/{bluePlan.period}</span>
                  </div>
                  <p className={styles.priceContext}>{billingCycle === 'monthly' ? '30 days of access · paid upfront' : `₹${(bluePlan.priceInr / bluePlan.months).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/month equivalent · ${bluePlan.days} days`}</p>
                </div> : <>
                  <div className={styles.priceLine}><span className={styles.price}><span className={styles.currency}>₹</span>{plan.id === 'lite' ? '0' : '100'}</span><span className={styles.period}>{plan.id === 'lite' ? '/forever' : '/trial'}</span></div>
                  <p className={styles.priceContext}>{plan.id === 'lite' ? 'No payment needed' : '1 credit · no expiry'}</p>
                </>}
              </div>

              {featured && <BillingCycleSelector value={billingCycle} onChange={setBillingCycle} disabled={subscribing} />}

              {featured ? <button type="button" className={`${styles.action} ${styles.primaryAction}`} onClick={handleSubscribe} disabled={subscribing}
                aria-label={subscribing ? 'Opening checkout' : `${current ? 'Extend' : 'Get'} Blue ${bluePlan.label} access for ₹${bluePlan.priceInr}`}>
                <span>{subscribing ? 'Opening checkout…' : current ? 'Extend access' : 'Get Blue'}</span>
                {subscribing ? <Loader2 size={18} aria-hidden="true" className={styles.spinner} /> : <ArrowUpRight size={18} aria-hidden="true" />}
              </button> : <Link className={`${styles.action} ${styles.secondaryAction}`} href={plan.id === 'blue_pro' ? '/blue-pro/checkout?pack=starter' : '/console'}>
                <span>{plan.id === 'blue_pro' ? 'Try Blue Pro' : user ? 'Open console' : 'Start for free'}</span><ArrowUpRight size={18} aria-hidden="true" />
              </Link>}
              {featured && subscribeError && <p role="alert" className={styles.checkoutError}>{subscribeError}</p>}

              <div className={styles.benefits}>
                <p className={styles.benefitsTitle}>{plan.benefitsTitle}</p>
                <ul>{plan.benefits.map(benefit => <li key={benefit}><Check size={15} aria-hidden="true" /><span>{benefit}</span></li>)}</ul>
              </div>
            </SpotlightCard>;
            return <article id={featured ? 'blue-plan' : undefined} aria-label={plan.name} key={plan.id} className={`${styles.plan} ${featured ? styles.featuredPlan : ''}`}
              style={{ '--entrance-delay': `${index * 70}ms` } as CSSProperties}>
              {featured ? <StarBorder className={styles.featuredFrame} speed="12s" color="#6da8ff">{card}</StarBorder> : card}
            </article>;
          })}
        </div>

        <div className={styles.bottomBar}>
          <p>One-time payments. No auto-renewal. Taxes included.</p>
          {user && <div className={styles.accountTools}><span>{imrBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })} IMR balance</span><button type="button" onClick={() => setIsClaimModalOpen(true)}><Plus size={13} aria-hidden="true" /> Redeem a coupon</button></div>}
        </div>

        <details className={styles.comparison}>
          <summary><span>Compare all features</span><ChevronDown size={17} aria-hidden="true" /></summary>
          <div className={styles.tableWrap}><table>
            <caption className="sr-only">Complete Blue feature comparison. Every Blue subscription duration includes the same features.</caption>
            <thead><tr><th scope="col">Features</th>{plans.map(plan => <th scope="col" key={plan.id}>{plan.name}</th>)}</tr></thead>
            <tbody>{allFeatures.map((feature, index) => <tr key={feature}><th scope="row">{feature}</th>{plans.map(plan => <td key={plan.id}>{plan.features[index] ? <><Check size={15} aria-hidden="true" /><span className="sr-only">Included</span></> : <><span aria-hidden="true">—</span><span className="sr-only">Not included</span></>}</td>)}</tr>)}</tbody>
          </table></div>
        </details>
        <p className={styles.legal}>By purchasing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      </div>
    </section>
    <ClaimCouponModal isOpen={isClaimModalOpen} onClose={() => setIsClaimModalOpen(false)} onSuccess={() => {}} />
  </MotionConfig></PageLayout>;
}
