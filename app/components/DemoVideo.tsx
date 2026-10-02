import LazyVideo from "./LazyVideo";
import styles from "./PremiumLanding.module.css";

export default function DemoVideo() {
  return (
    <section id="demo" className={styles.section} aria-labelledby="demo-title">
      <div className={styles.wrap}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>04 / In practice</span><h2 id="demo-title" className={styles.sectionTitle}>See the work.<br /><span>Not just the answer.</span></h2></div>
          <p className={styles.sectionDescription}>Watch a recorded example of Blue turning an idea into a portfolio website. Files, code, and a project taking shape—not just another chat response.</p>
        </div>
        <div className={styles.demoWindow}>
          <div className={styles.windowBar}><span /><span /><span /><p>BLUE / RECORDED DEMONSTRATION</p></div>
          <div className="aspect-video"><LazyVideo src="/videos/portfolio_demo.mp4" label="Recorded demonstration of Blue building a portfolio website" className="w-full h-full" /></div>
        </div>
        <div className={styles.demoCaption}><p>From a portfolio idea to a working project.</p><p>Recorded interface. Results and completion time depend on the task and model.</p></div>
      </div>
    </section>
  );
}
