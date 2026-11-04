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
            <span className={styles.eyebrow}>Blue Desktop by Imergene</span>
            <h1 id="blue-hero-title" className={styles.heroTitle}>Your AI coding<br />workspace.<br /><span>Blue Desktop.</span></h1>
            <p className={styles.heroDescription}>Blue Desktop is an AI coding assistant and agent-team workspace for Windows. Build projects, debug code and coordinate specialist AI agents for research and browser tasks. Prefer your editor? Use the Blue coding extension in VS Code.</p>
            <div className={styles.actions}>
              <DesktopDownloadLink className={styles.primary}>Download Blue for Windows <Download size={17} aria-hidden="true" /></DesktopDownloadLink>
              <Link prefetch={false} href="/console" className={styles.secondary}>Get Started for Free <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link prefetch={false} href="/contact" className={styles.textLink}>Book a Demo</Link>
            </div>
            <div className={styles.downloadOptions}><span>Microsoft-signed installer</span><DesktopDownloadLink variant="store" className={styles.textLink}>Open Microsoft Store <ArrowRight size={14} aria-hidden="true" /></DesktopDownloadLink></div>
            <div className={styles.heroPlatforms}><Code2 size={15} aria-hidden="true" /> In VS Code <span>Blue Desktop · Available for Windows</span></div>
            <div className={styles.actions}><Link prefetch={false} href="/desktop" className={styles.textLink}>Explore Blue Desktop <ArrowRight size={14} aria-hidden="true" /></Link><a href="#workspace" className={styles.textLink}>See the workspace <ArrowDown size={14} aria-hidden="true" /></a></div>
          </div>
          <BlueCore />
        </div>
        <div className={styles.platformStrip}>
          <p className={styles.platformIntro}>Built around your workflow</p>
          <div className={styles.platformItem}><Monitor size={21} aria-hidden="true" /><div>Your project, connected<small>Local tools. Real code.</small></div></div>
          <div className={styles.platformItem}><UsersRound size={21} aria-hidden="true" /><div>Independent work, in parallel<small>Team mode with a qualifying Blue Credit purchase.</small></div></div>
          <div className={styles.platformItem}><ShieldCheck size={21} aria-hidden="true" /><div>You stay in control<small>Guarded approvals and checkpoints.</small></div></div>
        </div>
      </div>
    </section>
  );
}
