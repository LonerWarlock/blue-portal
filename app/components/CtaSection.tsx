import Link from "next/link";
import { ArrowRight, Code2 } from "lucide-react";
import styles from "./PremiumLanding.module.css";
import InstallCommand from "./InstallCommand";

export default function CtaSection() {
  return (
    <section className={styles.cta} aria-labelledby="get-started-title">
      <div className={styles.wrap}>
        <span className={styles.eyebrow}>Your next chapter</span>
        <h2 id="get-started-title" className={`${styles.ctaTitle} mt-6`}>Big ideas.<br /><span>Start with Blue.</span></h2>
        <div className={styles.ctaBottom}>
          <p>Made specifically for students. Bring your curiosity, your code, and something you want to build.</p>
          <div className={styles.actions}><Link href="/console" className={styles.primary}>Get Started for Free <ArrowRight size={16} aria-hidden="true" /></Link><Link href="/pricing" className={styles.secondary}>Find your plan</Link></div>
        </div>
        <div className={styles.install}>
          <div><h3>Meet Blue where you code.</h3><p>Use Blue in VS Code today. Blue Desktop is launching soon.</p></div>
          <a className={styles.secondary} href="https://marketplace.visualstudio.com/items?itemName=om-mali.blue-coding-assistant" target="_blank" rel="noopener noreferrer"><Code2 size={18} aria-hidden="true" /> Explore the VS Code extension <ArrowRight size={15} aria-hidden="true" /></a>
        </div>
        <InstallCommand />
      </div>
    </section>
  );
}
