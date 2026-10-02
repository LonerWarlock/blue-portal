import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./PremiumLanding.module.css";

const families = [
  { lab: "OPENAI", name: "GPT", description: "An option for reasoning, code, and everyday project work." },
  { lab: "ANTHROPIC", name: "Claude", description: "An option for detailed explanations and complex changes." },
  { lab: "GOOGLE", name: "Gemini", description: "An option for multimodal questions and development tasks." },
  { lab: "DEEPSEEK", name: "DeepSeek", description: "An option for cost-conscious experimentation and coding." },
  { lab: "xAI", name: "Grok", description: "Another perspective for reasoning and implementation." },
];

export default function ModelsShowcase() {
  return (
    <section id="models" className={`${styles.section} ${styles.models}`} aria-labelledby="models-title">
      <div className={styles.wrap}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>03 / Intelligence</span><h2 id="models-title" className={styles.sectionTitle}>One workspace.<br /><span>Your choice of model.</span></h2></div>
          <p className={styles.sectionDescription}>Different projects call for different tools. Choose from supported model routes in Blue, with options for both experimentation and demanding work.</p>
        </div>
        <div className={styles.modelRail}>{families.map(family => <div key={family.name} className={styles.modelFamily}><small>{family.lab}</small><h3>{family.name}</h3><p>{family.description}</p></div>)}</div>
        <div className={styles.modelFootnote}><p>Model availability, capabilities, pricing, and rate limits vary by provider and plan. Blue is not affiliated with these model providers.</p><Link href="/pricing" className={styles.textLink}>Compare plans <ArrowRight size={14} aria-hidden="true" /></Link></div>
      </div>
    </section>
  );
}
