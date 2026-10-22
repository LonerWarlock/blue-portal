import {
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Maximize2,
  Menu,
  Minimize2,
  Folder,
  Globe2,
  Layers3,
  MessageSquare,
  Plus,
  Sun,
  UsersRound,
  X,
} from "lucide-react";
import styles from "./TeamWorkspacePreview.module.css";

type TeamWorkspacePreviewProps = {
  variant?: "hero" | "pricing" | "showcase";
};

const specialists = [
  { name: "Atlas", role: "Product engineer · focused implementation", color: "blue" },
  { name: "Nova", role: "Product lead · research and decisions", color: "indigo" },
  { name: "Echo", role: "AI and backend engineer", color: "cyan" },
  { name: "Lumen", role: "Growth and launch", color: "violet" },
] as const;

/**
 * A static, illustrative rendering of Blue Desktop's current Team workspace.
 * Its structure follows the desktop app shell, workspace rail, conversation,
 * composer and docked team panel; nothing here runs an agent or accesses a file.
 */
export default function TeamWorkspacePreview({ variant = "pricing" }: TeamWorkspacePreviewProps) {
  return (
    <section className={[styles.preview, styles[variant]].join(" ")} aria-label="Illustration of Blue Desktop Team workspace">
      <div className={styles.windowBar} aria-hidden="true">
        <div className={styles.windowMenus}><Menu size={12} /><ChevronLeft size={13} /><ChevronRight size={13} /><span className={styles.menuWord}>File</span><span className={styles.menuWord}>Help</span><span className={styles.themeToggle}><Sun size={11} />Light</span></div>
        <div className={styles.windowControls}><Minimize2 size={12} /><Maximize2 size={11} /><X size={13} /></div>
      </div>

      <div className={styles.desktop}>
        <div className={styles.teamWorkspace}>
          <header className={styles.teamHeader}>
            <div className={styles.teamBrand}><img src="/images/blue-symbol.png" alt="" /><strong>Blue</strong><span>/ Team</span></div>
            <div className={styles.accessLabel}><CircleDot size={10} />Team workspace · Full Access</div>
            <div className={styles.teamActions} aria-hidden="true">
              <span className={styles.activeAction}><MessageSquare size={12} />Conversation</span>
              <span><Globe2 size={12} />Browser</span>
              <span className={styles.model}><span>GPT-5.5</span><ChevronDown size={10} /></span>
              <span className={styles.activeAction}><UsersRound size={13} />Agents <i>4</i></span>
              <span className={styles.iconAction}><Layers3 size={13} /></span>
              <span className={styles.iconAction}><X size={13} /></span>
            </div>
          </header>

          <div className={styles.teamBody}>
            <nav className={styles.workspaceRail} aria-hidden="true">
              <p>WORKSPACES</p>
              <div><Layers3 size={13} /><span>All workspaces</span></div>
              <div className={styles.workspaceSelected}><Folder size={13} /><span>startup</span></div>
              <div className={styles.railNote}><UsersRound size={16} /><span>Your team, working together.<br />Give Blue an outcome to own.</span></div>
            </nav>

            <main className={styles.conversation}>
              <div className={styles.conversationHeading}><div><small>FOCUSED WORKSPACE</small><strong>startup</strong></div><span>4 agents</span></div>
              <div className={styles.transcript}>
                <div className={styles.userMessage}><small>You</small><p>Help me get this startup moving.</p></div>
                <div className={styles.blueMessage}><small>Blue</small><p>I’ll break the goal into focused work, coordinate the team, and keep the project organized as it moves forward.</p></div>
              </div>
              <div className={styles.composer}>
                <div className={styles.composerText}>What should we take care of in startup?</div>
                <div className={styles.composerToolbar}><span className={styles.plusButton}><Plus size={14} /></span><span>startup</span><span className={styles.sendButton}><ArrowUp size={15} /></span></div>
              </div>
              <small className={styles.composerHint}>Enter to send · Shift+Enter for a new line</small>
            </main>

            <aside className={styles.teamPanel} aria-hidden="true">
              <header><div><strong>Team</strong><span>Your project specialists</span></div><X size={14} /></header>
              <p className={styles.teamIntro}>Blue can assemble a focused team when work needs separate responsibilities, or reuse your specialists. Simple tasks stay simple.</p>
              <div className={styles.projectFilter}><span>Project</span><strong>startup <ChevronDown size={10} /></strong></div>
              <div className={styles.addSpecialist}><Plus size={14} />Add specialist</div>
              <section className={styles.specialistGroup}>
                <h2>STARTUP <span>4</span></h2>
                {specialists.map((specialist) => <div className={styles.specialist} key={specialist.name}>
                  <span className={`${styles.avatar} ${styles[specialist.color]}`}>{specialist.name.slice(0, 1)}</span>
                  <span className={styles.specialistInfo}><strong>{specialist.name}</strong><small>{specialist.role}</small></span>
                  <span className={styles.agentStatus}><CheckCircle2 size={11} />Ready</span>
                </div>)}
              </section>
              <p className={styles.teamFootnote}>Project instructions and results are saved. Blue and this computer need to stay on while work runs.</p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
