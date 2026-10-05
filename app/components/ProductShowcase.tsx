import LaserFlowHero from "./LaserFlowHero";
import styles from "./PremiumLanding.module.css";

export default function ProductShowcase() {
  return <section id="workspace" className={styles.productIntro} aria-labelledby="workspace-title">
    <div className={styles.wrap}><div className={styles.sectionHeading}>
      <div><span className={styles.eyebrow}>01 / The workspace</span><h2 id="workspace-title" className={styles.sectionTitle}>Less switching.<br /><span>More building.</span></h2></div>
      <div className={styles.sectionDescription}><p>Your project, conversation and tools, together. Follow the work as it happens—from the first question to the final change.</p><p>Blue Desktop is now available for Windows. Explore an interactive demo of the interface below.</p></div>
    </div></div>
    <LaserFlowHero />
  </section>;
}
