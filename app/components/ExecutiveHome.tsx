import Link from 'next/link';
import {ArrowUpRight,ArrowRight,Download,Workflow,Wallet,Users,KeyRound,Check,ShieldCheck} from 'lucide-react';
import DesktopDownloadLink from './DesktopDownloadLink';
import TeamsPromoVideo from './TeamsPromoVideo';
import styles from './executive-home.module.css';

export default function ExecutiveHome(){return <>
 <section className={styles.hero} aria-labelledby="blue-hero-title"><div className={styles.wrap}>
  <Link href="/organizations" className={`${styles.announcement} editorial-enter`} style={{animationDelay:'0ms'}}>Blue Desktop + VS Code Extension <span>·</span> Shared Organization Wallets <ArrowUpRight size={13}/></Link>
  <h1 id="blue-hero-title" className="editorial-enter" style={{animationDelay:'70ms'}}>One workspace.<br/><span>A whole new way to build.</span></h1>
  <p className={`${styles.lede} editorial-enter`} style={{animationDelay:'140ms'}}>From a focused coding session to a team of specialist AI agents. Build with your models, your tools, and a clear view of what you spend.</p>
  <div className={`${styles.actions} editorial-enter`} style={{animationDelay:'210ms'}}><DesktopDownloadLink className="executive-primary">Download Blue Desktop <Download size={16}/></DesktopDownloadLink><a className="executive-secondary" href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant" target="_blank" rel="noopener noreferrer">Get VS Code Extension <ArrowUpRight size={16}/></a></div>
  <div className={styles.heroNotes}><span><Check size={13}/>Free to start</span><span><ShieldCheck size={13}/>Windows Desktop</span><span>Choose your model for every agent</span></div>
 </div></section>
 <section id="blue-teams" className={`${styles.wrap} ${styles.showcase}`} aria-labelledby="teams-showcase-title" data-reveal>
  <div className={styles.sectionHead}><div><span className="eyebrow">BLUE TEAMS / IN MOTION</span><h2 id="teams-showcase-title">Give Blue a goal.<br/>Watch your team take shape.</h2></div><p>Lead agents plan. Specialists work in parallel. Reviewers check the results. One project, with you in control.</p></div>
  <TeamsPromoVideo/>
  <div className={styles.videoCaption}><span>Your AI team, working together.</span><Link href="/teams">Explore Blue Teams <ArrowRight size={14}/></Link></div>
 </section>
 <section id="features" className={`${styles.wrap} ${styles.capabilities}`} aria-labelledby="capabilities-title">
  <div className={styles.sectionHead} data-reveal><div><span className="eyebrow">BUILT FOR THE WAY YOU WORK</span><h2 id="capabilities-title">More capability.<br/>Less between you and the work.</h2></div><p>Code, coordinate, and stay connected to your project. Move between a personal coding agent and your AI team inside Blue Desktop.</p></div>
  <div className={styles.bento}>
   <article data-reveal><span className={styles.cardIndex}>01 / ORCHESTRATION</span><Workflow size={24} strokeWidth={1.35}/><h3>A team with a plan.</h3><p>Give the lead agent an outcome. It assigns specialists, coordinates parallel work and brings reviewers in to check the result.</p><div className={styles.workflow}><span>Plan</span><ArrowRight size={13}/><span>Build in parallel</span><ArrowRight size={13}/><span>Review</span></div><Link href="/teams">Meet Blue Teams <ArrowUpRight size={14}/></Link></article>
   <article data-reveal><span className={styles.cardIndex}>02 / COMPUTE</span><Wallet size={24} strokeWidth={1.35}/><h3>Pay for the work your model does.</h3><p>One Blue Credit covers US$1 of actual model usage. Use a fast, economical model for everyday work and a flagship model when the task calls for it.</p><div className={styles.costExample}><strong>1.00 <small>Blue Credit</small></strong><span>At an illustrative US$0.02 per task,<br/>that’s 50 tasks. Actual costs vary.</span></div><Link href="/pricing">See how credits work <ArrowUpRight size={14}/></Link></article>
   <article data-reveal><span className={styles.cardIndex}>03 / ORGANIZATIONS</span><Users size={24} strokeWidth={1.35}/><h3>One balance. Everyone included.</h3><p>Start with 50 credits and five member seats. Every 10 purchased credits unlocks a permanent seat, with individual accounts and optional spending caps.</p><div className={styles.seatExample}><span>50 credits</span><span>5 permanent seats</span><span>No idle-seat subscription</span></div><Link href="/organizations">Bring your organization <ArrowUpRight size={14}/></Link></article>
   <article data-reveal><span className={styles.cardIndex}>04 / MODEL FREEDOM</span><KeyRound size={24} strokeWidth={1.35}/><h3>Your keys. Your choice.</h3><p>Connect your own provider with the ₹149 / US$1.99 personal app-access pass. Provider usage is billed directly by your provider. Supported local models remain available in Blue Lite.</p><div className={styles.modelTags}><span>Bring your API key</span><span>Supported local models</span><span>Multiple model families</span></div><Link href="/docs#models">Explore model connections <ArrowUpRight size={14}/></Link></article>
  </div>
 </section>

</>;}
export function ExecutiveClosing(){return <section className={`${styles.wrap} ${styles.closing}`} data-reveal><span className="eyebrow">YOUR NEXT CHAPTER</span><h2>Start with an idea.<br/>Build it with Blue.</h2><div className={styles.actions}><DesktopDownloadLink className="executive-primary">Get Blue for Windows <ArrowRight size={16}/></DesktopDownloadLink><Link className="executive-secondary" href="/pricing">Find your plan</Link></div></section>;}
