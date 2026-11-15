"use client";
import {useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight,Building2,Check,UsersRound} from 'lucide-react';
import styles from './organization-pricing.module.css';
const benefits=['Blue Desktop and AI Teams for every member','One shared Blue Credit balance','Individual accounts and email invitations','Per-member spending caps and usage records','A dedicated owner admin console'];
export default function OrganizationPricing(){
 const [currency,setCurrency]=useState<'INR'|'USD'>('INR');
 return <div className={styles.wrapper}>
  <div className={styles.toolbar}><p>One organization. A shared budget.</p><div className={styles.currency} role="group" aria-label="Organization pricing currency"><button type="button" aria-pressed={currency==='INR'} onClick={()=>setCurrency('INR')}>INR ₹</button><button type="button" aria-pressed={currency==='USD'} onClick={()=>setCurrency('USD')}>USD $</button></div></div>
  <div className={styles.grid}>
   <article className={styles.card} aria-labelledby="organization-plan-title">
    <UsersRound size={26} strokeWidth={1.35} aria-hidden="true"/><div className={styles.heading}><h2 id="organization-plan-title">Organization</h2><p>For companies bringing Blue to their people.</p></div>
    <div className={styles.priceBlock}><p className={styles.eyebrow}>Starting credit purchase</p><div className={styles.price} aria-live="polite"><span>{currency==='INR'?'₹':'$'}</span>{currency==='INR'?'5,750':'57.50'}</div><p className={styles.priceNote}>50 Blue Credits · 5 member seats</p><p className={styles.unitPrice}>{currency==='INR'?'₹115':'US$1.15'} per credit · one-time purchase</p></div>
    <Link href="/organizations#create" className={styles.primary}>Get started <ArrowUpRight size={17} aria-hidden="true"/></Link>
    <div className={styles.features}><p>Included for your organization</p><ul>{benefits.map(item=><li key={item}><Check size={16} aria-hidden="true"/>{item}</li>)}</ul></div>
    <p className={styles.cardFoot}>Buy 50–1,000 credits online. Seats and unused credits do not expire.</p>
   </article>
   <article className={styles.card+' '+styles.customCard} aria-labelledby="custom-plan-title">
    <Building2 size={26} strokeWidth={1.35} aria-hidden="true"/><div className={styles.heading}><h2 id="custom-plan-title">Custom</h2><p>For larger organizations with a bigger rollout.</p></div>
    <div className={styles.priceBlock}><p className={styles.eyebrow}>Beyond 1,000 credits</p><div className={styles.customPrice}>Let’s talk.</div><p className={styles.priceNote}>A credit order built around your needs.</p><p className={styles.unitPrice}>Discuss volume and member requirements.</p></div>
    <Link href="/contact?topic=organization" className={styles.secondary}>Contact sales <ArrowUpRight size={17} aria-hidden="true"/></Link>
    <div className={styles.features}><p>The same Organization foundation</p><ul>{['Shared credits across individual accounts','Spending controls for every member','Central billing and usage records','Custom credit quantities through sales'].map(item=><li key={item}><Check size={16} aria-hidden="true"/>{item}</li>)}</ul></div>
    <div className={styles.salesNote}><span>Already using Blue?</span><Link href="/organizations">Manage your organizations <ArrowUpRight size={14} aria-hidden="true"/></Link></div>
   </article>
  </div>
  <div className={styles.policy}><span>No separate per-member subscription.</span><span>1 Blue Credit = US$1 of model usage.</span><span>Works with your local projects.</span></div>
  <section className={styles.details} aria-labelledby="organization-details-title"><h2 id="organization-details-title">Simple to run. Clear to manage.</h2><div>
   <article><span>01</span><h3>Credits unlock seats.</h3><p>Every 10 credits purchased unlocks one member seat. The owner counts as a member. Spending credits does not reduce your seats.</p></article>
   <article><span>02</span><h3>Everyone has their own account.</h3><p>Invite your colleagues by email. They choose your Organization in Blue and use its shared credits for their work.</p></article>
   <article><span>03</span><h3>You set the limits.</h3><p>Give each person a credit cap or leave it unrestricted. See settled spending and credits reserved by active tasks.</p></article>
  </div></section>
 </div>;
}
