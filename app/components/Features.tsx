import Link from "next/link";
import { ArrowRight, FolderSearch, Workflow, ShieldCheck, Plug } from "lucide-react";
import styles from "./PremiumLanding.module.css";

const features = [
  { icon: FolderSearch, title: "Understand what you're building.", description: "Explore a project's architecture, trace unfamiliar code, and ask for explanations while you work. Go beyond a copied answer to understand the change.", detail: "A clearer starting point for coursework and personal projects." },
  { icon: Workflow, title: "Move from idea to implementation.", description: "Ask Blue to plan a change, edit project files, and run relevant checks. When a task benefits from parallel work, eligible paid users can enable multiple agents.", detail: "Work in your project, not in an isolated prompt box." },
  { icon: ShieldCheck, title: "Make progress. Keep control.", description: "Approve for me handles routine project work while asking about sensitive actions. Available task checkpoints let you review and restore supported file changes.", detail: "Credentials, outside-project actions, and publishing still need care." },
  { icon: Plug, title: "Connect the tools you already use.", description: "Bring supported GitHub, Canva, and Vercel connections into your workflow. Keep your account permissions and provider limits in view.", detail: "Connections require sign-in and depend on third-party availability." },
];

export default function Features() {
  return (
    <section id="features" className={styles.section} aria-labelledby="capabilities-title">
      <div className={styles.wrap}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>02 / Capabilities</span><h2 id="capabilities-title" className={styles.sectionTitle}>From a first idea.<br /><span>To a working change.</span></h2></div>
          <p className={styles.sectionDescription}>Made specifically for students. Built to help you understand your code, develop your ideas, and gain confidence through hands-on work.</p>
        </div>
        <div className={styles.featureRows}>
          {features.map(({ icon: Icon, ...feature }, index) => <article key={feature.title} className={styles.featureRow}>
            <span className={styles.featureNumber}>0{index + 1}</span>
            <div className={styles.featureName}><Icon size={24} aria-hidden="true" /><h3>{feature.title}</h3></div>
            <div><p>{feature.description}</p><small>{feature.detail}</small></div>
          </article>)}
        </div>
        <Link href="/docs" className={`${styles.textLink} mt-6`}>Explore the documentation <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
