"use client";

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Check, ChevronDown, GraduationCap, Building2, Loader2, Plus, Sparkles } from 'lucide-react';
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
    benefitsTitle: 'Everything in Blue, plus', benefits: ['Selected Premium Models', 'Credits that never expire', '25-credit purchase unlocks Teams'],
    features: [true, true, true, true, true, true, true, true, true, true, true, true, true, true] },
] as const;

export default function PricingClient() {
  const { user, session, account, accountLoading, accountError, invalidateAccount } = useAuth();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [displayCurrency,setDisplayCurrency]=useState<'INR'|'USD'>('INR');
  const [personalQuantity,setPersonalQuantity]=useState('25'),[organizationQuantity,setOrganizationQuantity]=useState('50');
  const validPersonal=Number.isSafeInteger(Number(personalQuantity))&&Number(personalQuantity)>=1&&Number(personalQuantity)<=100;
  const validOrganization=Number.isSafeInteger(Number(organizationQuantity))&&Number(organizationQuantity)>=50&&Number(organizationQuantity)<=1000;
  const money=(amount:number)=>displayCurrency==='INR'?'₹'+amount.toLocaleString('en-IN',{maximumFractionDigits:2}):'$'+amount.toFixed(2);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');
  const [billingCycle, setBillingCycle] = useState<BlueBillingCycle>('monthly');
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const bluePlan = BLUE_SUBSCRIPTION_PLANS[billingCycle];
  const activePlan = account?.subscription.plan || 'lite';
  // Model-credit access can make the effective plan Blue Pro while the user's
  // separately paid Blue app-access period is still active.
  const accessExpiry = account?.subscription.monthly_expires_at;
  const activeBlueAccess = Boolean(user && account?.subscription.monthly_plan === 'blue'
    && (accessExpiry == null || (Number.isFinite(Date.parse(accessExpiry)) && Date.parse(accessExpiry) > Date.now())));
  const activeBillingCycle = account?.subscription.billing_cycle;
  const activeCycleLabel = isBlueBillingCycle(activeBillingCycle) ? BLUE_SUBSCRIPTION_PLANS[activeBillingCycle].label : null;
  const imrBalance = Number(account?.wallet.balance || 0);

  useEffect(() => {
    const params=new URLSearchParams(window.location.search);
    if(params.get('audience')==='organizations')document.getElementById('organization-plan')?.scrollIntoView({block:'center'});
    const cycle = params.get('billing_cycle');
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
          <div className={styles.kicker}><span>PRICING</span><span className={styles.kickerRule}/>A clear way to build.</div>
          <h1 id="pricing-title" className={styles.title}>Your work. Your models.<br/><span>Your way to pay.</span></h1>
          <p className={styles.introCopy}>Personal access, on-demand compute, or a shared Organization balance. Choose what works for you.</p>
        </header>

        {accountLoading && user && !account && <p role="status" className={styles.accountMessage}>Loading your plan…</p>}
        {accountError && <p role="alert" className={styles.error}>{accountError} <button type="button" onClick={() => void invalidateAccount()}>Retry</button></p>}
        {activeBlueAccess && <p role="status" className={styles.accountMessage}>
          Blue app access is active{accessExpiry ? ` until ${new Date(accessExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : ' with no expiry'}.
          {activeCycleLabel && ` Last access purchase: ${activeCycleLabel}.`} Buying another duration adds time after your existing access; it does not replace or shorten it.
        </p>}

        <div className={styles.currencySwitch} role="group" aria-label="Pricing currency"><button aria-pressed={displayCurrency==='INR'} onClick={()=>setDisplayCurrency('INR')}>INR ₹</button><button aria-pressed={displayCurrency==='USD'} onClick={()=>setDisplayCurrency('USD')}>USD $</button></div>
        <div className={styles.grid}>
          <article className={styles.matrixCard} id="blue-plan" data-reveal>
            <span className={styles.planKicker}>APP ACCESS</span><h2>BYOK pass</h2><p className={styles.description}>Your provider. Your keys. Your workflow.</p>
            <div className={styles.matrixPrice}><motion.span key={billingCycle+displayCurrency} initial={reducedMotion?false:{opacity:.6,y:4}} animate={{opacity:1,y:0}} transition={{duration:.18,ease:[.16,1,.3,1]}}>{money(displayCurrency==='INR'?bluePlan.priceInr:bluePlan.priceUsd)}</motion.span><small>/{bluePlan.period}</small></div>
            <p className={styles.priceContext}>{bluePlan.days} days of personal app access · 0 Blue Credits included</p>
            <BillingCycleSelector value={billingCycle} onChange={setBillingCycle} disabled={subscribing}/>
            <button type="button" className={styles.matrixPrimary} onClick={handleSubscribe} disabled={subscribing} aria-label={subscribing?'Opening checkout':`${activeBlueAccess?'Extend':'Get'} Blue ${bluePlan.label} access for ₹${bluePlan.priceInr}`}>{subscribing?'Opening checkout…':activeBlueAccess?'Extend access':'Get Blue'}<ArrowUpRight size={15}/></button>
            {activeBlueAccess&&<span className={styles.matrixBadge}>Active app access</span>}{subscribeError&&<p role="alert" className={styles.error}>{subscribeError}</p>}
            <ul className={styles.matrixBenefits}>{['Your own provider API keys','Normal coding workspace in Desktop and VS Code','Supported tools and connectors','Provider usage billed by your provider','No automatic renewal'].map(s=><li key={s}><Check size={14}/>{s}</li>)}</ul>
            <p className={styles.cardNote}>A personal access pass. Blue Teams credit eligibility is separate.</p>
          </article>
          <article className={styles.matrixCard} data-reveal>
            <span className={styles.planKicker}>PERSONAL COMPUTE</span><h2>Personal Credits</h2><p className={styles.description}>Pay as you go. Build at your own pace.</p>
            <div className={styles.matrixPrice}><span>{money(displayCurrency==='INR'?115:1.30)}</span><small>/ credit</small></div><p className={styles.priceContext}>1 Blue Credit = US$1 of model usage</p>
            <label className={styles.creditLabel}>Blue Credits<input aria-label="Personal credit quantity" type="number" min="1" max="100" step="1" value={personalQuantity} onChange={e=>setPersonalQuantity(e.target.value)} onBlur={()=>{if(!validPersonal)setPersonalQuantity('25');}}/></label>
            <div className={styles.quoteLine}><span>Total</span><motion.span key={personalQuantity+displayCurrency} initial={reducedMotion?false:{opacity:.5,y:3}} animate={{opacity:1,y:0}} transition={{duration:.18}}>{validPersonal?money(Number(personalQuantity)*(displayCurrency==='INR'?115:1.30)):'—'}</motion.span></div>
            <Link aria-disabled={!validPersonal} onClick={e=>{if(!validPersonal)e.preventDefault();}} className={styles.matrixPrimary} href={`/blue-pro/checkout?pack=custom&credits=${personalQuantity}&currency=${displayCurrency}`}>Add personal credits<ArrowUpRight size={15}/></Link>
            <ul className={styles.matrixBenefits}>{['A balance that never expires','Choose from supported Blue Models','Usage charged at actual model cost','Purchase 25+ credits to unlock Teams','Keep personal and Organization balances separate'].map(s=><li key={s}><Check size={14}/>{s}</li>)}</ul>
            <p className={styles.cardNote}>No separate platform fee added at checkout.</p>
          </article>
          <article className={styles.matrixCard} id="organization-plan" data-reveal>
            <span className={styles.planKicker}>SHARED COMPUTE</span><h2>Organization</h2><p className={styles.description}>One shared balance. Your whole company.</p>
            <div className={styles.matrixPrice}><span>{money(displayCurrency==='INR'?115:1.15)}</span><small>/ credit</small></div><p className={styles.priceContext}>Minimum 50 credits · no monthly seat fee</p>
            <label className={styles.creditLabel}>Organization credits<input aria-label="Organization credit quantity" type="number" min="50" max="1000" step="1" value={organizationQuantity} onChange={e=>setOrganizationQuantity(e.target.value)} onBlur={()=>{if(!validOrganization)setOrganizationQuantity('50');}}/></label>
            <input className={styles.creditRange} aria-label="Adjust Organization credits" type="range" min="50" max="1000" step="1" value={validOrganization?organizationQuantity:50} aria-valuetext={`${organizationQuantity} credits, ${Math.floor(Number(organizationQuantity)/10)} member seats`} onChange={e=>setOrganizationQuantity(e.target.value)}/>
            <div className={styles.quoteLine} aria-live="polite"><span>Total</span><motion.span key={organizationQuantity+displayCurrency} initial={reducedMotion?false:{opacity:.5,y:3}} animate={{opacity:1,y:0}} transition={{duration:.18}}>{validOrganization?money(Number(organizationQuantity)*(displayCurrency==='INR'?115:1.15)):'—'}</motion.span></div>
            <p className={styles.seatCount}><strong>{validOrganization?Math.floor(Number(organizationQuantity)/10):'—'} permanent seats</strong> unlocked by this purchase. Owner included.</p>
            <Link aria-disabled={!validOrganization} onClick={e=>{if(!validOrganization)e.preventDefault();}} href={`/organizations?credits=${organizationQuantity}&currency=${displayCurrency}`} className={styles.matrixPrimary}>Get Organization<ArrowUpRight size={15}/></Link>
            <ul className={styles.matrixBenefits}>{['Blue Desktop, Teams and VS Code access','Separate owner admin console','Optional lifetime caps per member','Shared credits and individual accounts','Permanent seats: 1 per 10 credits purchased'].map(s=><li key={s}><Check size={14}/>{s}</li>)}</ul>
            <Link href="/contact?topic=organization" className={styles.matrixSales}>1,000+ credits? Contact sales <ArrowUpRight size={13}/></Link>
          </article>
        </div>
        <div className={styles.freeStrip}><div><strong>Blue Lite. Free to start.</strong><p>Explore AI chat, core coding tools and supported local models.</p></div><Link href="/console">{user?'Open console':'Start for free'} <ArrowUpRight size={14}/></Link></div>

        <div className={styles.bottomBar}>
          <p>One-time payments. No auto-renewal. Taxes included.</p>
          {user && <div className={styles.accountTools}><span>{imrBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })} IMR balance</span><button type="button" onClick={() => setIsClaimModalOpen(true)}><Plus size={13} aria-hidden="true" /> Redeem a coupon</button></div>}
        </div>

        <section aria-labelledby="billing-explanation-title" className="mt-6 border-t border-line pt-6">
          <h2 id="billing-explanation-title" className="text-base font-semibold text-ink">App access and model usage are separate.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted">Blue by Imergene subscriptions unlock app features. Monthly, quarterly and yearly purchases have the same features; only the price and access duration differ. Further purchases extend remaining access. There is no automatic renewal to cancel. Blue Pro credits are separate, never expire and are not replaced by an app-access purchase. BYOK model usage is billed by your provider where applicable; Blue Pro model usage is paid with Blue Credits. There is no fixed Blue Credit fee for each code edit, local test, or deployment.</p>
          <Link href="/about#billing" className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-brand hover:underline">How Blue&apos;s billing works <ArrowUpRight size={14} aria-hidden="true" className="ml-1" /></Link>
        </section>

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
