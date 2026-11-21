import LazyVideo from "./LazyVideo";
import styles from "./PremiumLanding.module.css";

export default function DemoVideo() {
  return (
    <section id="demo" className={styles.section} aria-labelledby="demo-title">
      <div className={styles.wrap}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>RECORDED PROJECT</span><h2 id="demo-title" className={styles.sectionTitle}>Watch Blue build a portfolio.</h2></div>
          <p className={styles.sectionDescription}>See Blue edit project files and build a portfolio site.</p>
        </div>
        <div className={styles.demoWindow}>
          <div className={styles.windowBar}><span /><span /><span /><p>BLUE / RECORDED DEMONSTRATION</p></div>
          <div className="aspect-video"><LazyVideo src="/videos/portfolio_demo.mp4" label="Recorded demonstration of Blue building a portfolio website" className="w-full h-full" /></div>
        </div>
        <div className={styles.demoCaption}><p>Recorded portfolio project</p></div>
      </div>
    </section>
  );
}
