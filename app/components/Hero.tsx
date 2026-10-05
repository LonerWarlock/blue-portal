import Link from "next/link";
import { ArrowDown, ArrowRight, Code2, Download, Monitor, ShieldCheck, UsersRound } from "lucide-react";
import DesktopDownloadLink from "./DesktopDownloadLink";
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
            <p className={styles.heroDescription}>Blue is an AI coding assistant by Imergene, made specifically for students. Understand code, build coursework and personal projects, and debug with Blue Desktop for Windows or the VS Code extension.</p>
            <div className={styles.actions}>
              <DesktopDownloadLink className={styles.primary}>Download Blue for Windows <Download size={17} aria-hidden="true" /></DesktopDownloadLink>
              <Link prefetch={false} href="/console" className={styles.secondary}>Get Started for Free <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link prefetch={false} href="/contact" className={styles.textLink}>Book a Demo</Link>
            </div>
            <div className={styles.downloadOptions}><span>Microsoft-signed installer</span><DesktopDownloadLink variant="store" className={styles.textLink}>Open Microsoft Store <ArrowRight size={14} aria-hidden="true" /></DesktopDownloadLink></div>
            <div className={styles.heroPlatforms}><Code2 size={15} aria-hidden="true" /> In VS Code <span>Blue Desktop · Available for Windows</span></div>
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
