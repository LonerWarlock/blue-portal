'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import PageLayout from '@/app/components/PageLayout';
import TeamWorkspacePreview from '@/app/components/TeamWorkspacePreview';
import styles from './teams.module.css';

const activationCheckout = '/blue-pro/checkout?pack=custom&credits=25';

export default function TeamsClient() {
  const { user, loading, account, accountLoading, accountError, invalidateAccount } = useAuth();
  // A payment return or the visible wallet amount never grants access. Only
  // the current authenticated account's verified Teams entitlement does.
  const accountReady = Boolean(user?.id && account?.user_id === user.id && !loading && !accountLoading && !accountError);
  const teams = accountReady ? account?.teams : null;
  const verifying = Boolean(loading || user && !accountReady && !accountError);
  const unavailable = Boolean(accountReady && (!teams || teams.available === false));
  const hasAccess = Boolean(teams?.available !== false && teams?.status === 'active'
    && (teams.plan === 'payg' || ['solo', 'pro', 'business'].includes(String(teams.plan))
      && teams.current_period_end && Number.isFinite(Date.parse(teams.current_period_end)) && Date.parse(teams.current_period_end) > Date.now()));
  const legacyAccess = hasAccess && teams?.access_source === 'legacy_subscription';
  const credits = typeof teams?.available_blue_credits === 'number' && Number.isFinite(teams.available_blue_credits)
    ? Math.max(0, teams.available_blue_credits) : null;

  return <PageLayout>
    <section className={styles.page}>
      <div className={styles.container}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}><Sparkles size={14} aria-hidden="true" /> Blue Teams</p>
          <h1>Your team.<br /><span>Working together.</span></h1>
          <p className={styles.lede}>Give Blue a goal. It organizes the work, assigns specialists and keeps each project’s progress together—so you can focus on the outcome.</p>
          <Link href="#credits" className={styles.heroCta}>Use Teams with Blue Credits <ArrowRight size={16} aria-hidden="true" /></Link>
        </header>

        <section className={styles.previewSection} aria-labelledby="preview-title">
          <div className={styles.previewCopy}>
            <p className={styles.eyebrow}>One organized workspace</p>
            <h2 id="preview-title">A team that moves the work forward.</h2>
            <p>Blue coordinates specialist agents and brings you in when a decision or approval is needed. The main agent and specialists use Blue Models and the same Blue Credit wallet.</p>
            <p className={styles.computerNote}>Blue Teams runs on your computer. Keep Blue open and your computer turned on while work is running.</p>
          </div>
          <TeamWorkspacePreview variant="pricing" />
        </section>

        <section id="credits" className={styles.plansSection} aria-labelledby="credits-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Pay as you go</p><h2 id="credits-title">Buy credits. Keep your team moving.</h2></div>
            <p>One wallet. No separate Teams subscription or monthly credit reset.</p>
          </div>

          {verifying && <p className={styles.info} role="status">Checking your Teams access…</p>}
          {user && (accountError || unavailable) && <div className={styles.error} role="alert"><p>Your Teams access could not be verified. <button type="button" onClick={() => void invalidateAccount()}>Retry account refresh</button></p></div>}
          {accountReady && !unavailable && <section className={hasAccess ? styles.notice : styles.info} aria-label="Your Blue Teams access">
            <ShieldCheck size={18} aria-hidden="true" /><div>
              <strong>{hasAccess ? 'Blue Teams is active' : 'Blue Teams needs a qualifying credit purchase'}</strong>
              {credits !== null && <p>{credits.toLocaleString('en-US', { maximumFractionDigits: 4 })} Blue Credits available.</p>}
              {legacyAccess && teams?.current_period_end ? <p>Your previously purchased Teams access is honoured until <time dateTime={teams.current_period_end}>{new Date(teams.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</time>. Blue Models use your Blue Credits.</p>
                : <p>{hasAccess ? 'Top up before your balance runs out to keep Teams active. Added credits combine with your remaining balance.' : 'Purchase at least 25 Blue Credits in one payment to activate or reactivate Teams.'}</p>}
              <button type="button" onClick={() => void invalidateAccount()}>Refresh access</button>
            </div>
          </section>}

          <article className={styles.creditCard} aria-label="Blue Teams pay as you go">
            <div>
              <p className={styles.tier}>Blue Teams with Blue Credits</p>
              <p className={styles.audience}>A qualifying purchase adds usable model credits. It is not an activation fee.</p>
              <div className={styles.price}><span>25</span><small>Blue Credits to unlock Teams</small></div>
              <p className={styles.usdPrice}>$25.00 in credits + $7.50 platform fee = $32.50 USD. INR total is shown at checkout.</p>
              <ul className={styles.features}>
                {['1 Blue Credit covers $1 of actual OpenRouter model usage', '30% platform fee charged at purchase; no additional usage markup', 'Main agent and specialists use Blue Models', 'Up to 10 project teams and 8 agents per team', 'Unused credits carry forward; top-ups add to the same wallet'].map(feature => <li key={feature}><Check size={15} aria-hidden="true" /><span>{feature}</span></li>)}
              </ul>
              <Link href={hasAccess ? '/blue-pro/checkout' : activationCheckout} className={styles.primaryButton}>{hasAccess ? 'Add Blue Credits' : 'Buy 25 Blue Credits'} <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className={styles.creditRules}>
              <h3>How access works</h3>
              <ol>
                <li><strong>Activate:</strong> purchase at least 25 Blue Credits in one payment.</li>
                <li><strong>Top up:</strong> add any available pack while Teams is active. Your remaining credits stay in your wallet.</li>
                <li><strong>At zero:</strong> Teams pauses. Your agents, tasks and conversations remain saved.</li>
                <li><strong>Reactivate:</strong> purchase at least 25 Blue Credits again.</li>
              </ol>
              <p>Example: buy 25, use 10, then add 25. Your balance becomes 40 Blue Credits and Teams stays active.</p>
            </div>
          </article>
          <div className={styles.terms}><p>Credits do not expire or reset monthly. Payment must be confirmed before credits or Teams access are added. You sign in before completing checkout.</p><p>Teams uses Blue Models. Connect your own OpenRouter key for ordinary project work; Teams model usage is billed to your Blue Credit wallet.</p></div>
        </section>
        <p className={styles.legal}>By purchasing, you agree to the <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/refund">Refund Policy</Link>.</p>
      </div>
    </section>
  </PageLayout>;
}
