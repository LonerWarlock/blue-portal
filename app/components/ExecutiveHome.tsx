import Link from 'next/link';
import {ArrowUpRight,ArrowRight,Download,Workflow,Wallet,Users,KeyRound,Check,ShieldCheck} from 'lucide-react';
import DesktopDownloadLink from './DesktopDownloadLink';
import TeamsPromoVideo from './TeamsPromoVideo';
import styles from './executive-home.module.css';

export default function ExecutiveHome(){return <>
 <section className={styles.hero} aria-labelledby="blue-hero-title"><div className={styles.wrap}>
  <Link href="/organization-plan" className={`${styles.announcement} editorial-enter`} style={{animationDelay:'0ms'}}>Organization Plan <span>·</span> Share credits. Set spending limits. <ArrowUpRight size={13}/></Link>
  <h1 id="blue-hero-title" className="editorial-enter" style={{animationDelay:'70ms'}}>Your coding agent.<br/><span>Your AI team. One app.</span></h1>
  <p className={`${styles.lede} editorial-enter`} style={{animationDelay:'140ms'}}>Edit code with Blue. Give bigger jobs to AI specialists. Stay in the same app.</p>
  <div className={`${styles.actions} editorial-enter`} style={{animationDelay:'210ms'}}><DesktopDownloadLink className="executive-primary">Download Blue Desktop <Download size={16}/></DesktopDownloadLink><a className="executive-secondary" href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant" target="_blank" rel="noopener noreferrer">Get VS Code Extension <ArrowUpRight size={16}/></a></div>
  <div className={styles.heroNotes}><span><Check size={13}/>Free to start</span><span><ShieldCheck size={13}/>Windows Desktop</span><span>Choose a model for each agent</span></div>
 </div></section>
 <section id="blue-teams" className={`${styles.wrap} ${styles.showcase}`} aria-labelledby="teams-showcase-title" data-reveal>
  <div className={styles.sectionHead}><div><span className="eyebrow">PRODUCT WALKTHROUGH</span><h2 id="teams-showcase-title">A quick tour of Blue Teams.</h2></div><p>See how Blue organizes work across specialists.</p></div>
  <TeamsPromoVideo/>
  <div className={styles.videoCaption}><span>Promotional walkthrough · See the recorded project below</span><Link href="/teams">Explore Blue Teams <ArrowRight size={14}/></Link></div>
 </section>
 <section id="features" className={`${styles.wrap} ${styles.capabilities}`} aria-labelledby="capabilities-title">
  <div className={styles.sectionHead} data-reveal><div><span className="eyebrow">WHY CHOOSE BLUE</span><h2 id="capabilities-title">Code. Delegate. Stay in control.</h2></div><p>Use a coding agent for focused work. Use Teams when a task needs more than one agent.</p></div>
  <div className={styles.bento}>
   <article data-reveal><Workflow size={24} strokeWidth={1.35}/><h3>Give work to AI agents.</h3><p>Tell Blue what you need. It assigns agents to separate jobs. Reviewers check their work.</p><div className={styles.workflow}><span>Plan</span><ArrowRight size={13}/><span>Build in parallel</span><ArrowRight size={13}/><span>Review</span></div><Link href="/teams">Meet Blue Teams <ArrowUpRight size={14}/></Link></article>
   <article data-reveal><Wallet size={24} strokeWidth={1.35}/><h3>See what your credits cover.</h3><p>Buy credits when you need them. Your model and usage determine how much you spend.</p><div className={styles.costExample}><strong>1 <small>Blue Credit</small></strong><span>US$1 of model usage</span></div><Link href="/pricing">See how credits work <ArrowUpRight size={14}/></Link></article>
   <article data-reveal><Users size={24} strokeWidth={1.35}/><h3>Share credits with your company.</h3><p>Give employees one shared credit balance. Set spending limits. See who used what.</p><div className={styles.seatExample}><span>50 credits</span><span>5 permanent seats</span><span>No monthly seat fee</span></div><Link href="/organization-plan">See the Organization Plan <ArrowUpRight size={14}/></Link></article>
   <article data-reveal><KeyRound size={24} strokeWidth={1.35}/><h3>Use your own API key.</h3><p>Connect your own provider key. Your provider bills you for model usage. Blue Lite also supports local models.</p><div className={styles.modelTags}><span>Bring your API key</span><span>Supported local models</span><span>Multiple model families</span></div><Link href="/docs#models">Explore model connections <ArrowUpRight size={14}/></Link></article>
  </div>
 </section>

</>;}
export function ExecutiveClosing(){return <section className={`${styles.wrap} ${styles.closing}`} data-reveal><span className="eyebrow">START WITH BLUE</span><h2>Try Blue on your next project.</h2><div className={styles.actions}><DesktopDownloadLink className="executive-primary">Get Blue for Windows <ArrowRight size={16}/></DesktopDownloadLink><Link className="executive-secondary" href="/pricing">See pricing</Link></div></section>;}
