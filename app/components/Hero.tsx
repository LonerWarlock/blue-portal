import Link from "next/link";
import { ArrowDown, ArrowRight, Code2, Monitor, ShieldCheck, UsersRound } from "lucide-react";
import BlueCore from "./BlueCore";
import styles from "./PremiumLanding.module.css";

export default function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="blue-hero-title">
      <div className={styles.wrap}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Made specifically for students</span>
            <h1 id="blue-hero-title" className={styles.heroTitle}>Your ideas.<br />Blue&apos;s craft.<br /><span>Build what&apos;s next.</span></h1>
            <p className={styles.heroDescription}>Learn by building. Turn coursework, ambitious side projects, and your next big idea into real software—with an AI coding workspace that works alongside you.</p>
            <div className={styles.actions}>
              <Link prefetch={false} href="/console" className={styles.primary}>Get Started for Free <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link prefetch={false} href="/contact" className={styles.secondary}>Book a Demo</Link>
            </div>
            <div className={styles.heroPlatforms}><Code2 size={15} aria-hidden="true" /> In VS Code <span>Blue Desktop · Launching soon</span></div>
            <a href="#workspace" className={styles.textLink}>Explore the workspace <ArrowDown size={14} aria-hidden="true" /></a>
          </div>
          <BlueCore />
        </div>
        <div className={styles.platformStrip}>
          <p className={styles.platformIntro}>Built around your workflow</p>
          <div className={styles.platformItem}><Monitor size={21} aria-hidden="true" /><div>Your project, connected<small>Local tools. Real code.</small></div></div>
          <div className={styles.platformItem}><UsersRound size={21} aria-hidden="true" /><div>Independent work, in parallel<small>Multi-agent on eligible paid plans.</small></div></div>
          <div className={styles.platformItem}><ShieldCheck size={21} aria-hidden="true" /><div>You stay in control<small>Guarded approvals and checkpoints.</small></div></div>
        </div>
      </div>
    </section>
  );
}
