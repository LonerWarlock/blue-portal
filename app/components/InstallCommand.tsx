"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./PremiumLanding.module.css";

const BLUE_INSTALL_COMMAND = "code --install-extension om-mali.blue-coding-assistant";

export default function InstallCommand() {
  const [status, setStatus] = useState<"idle" | "copied" | "unavailable">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(BLUE_INSTALL_COMMAND);
      setStatus("copied");
      timer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch { setStatus("unavailable"); }
  }
  return <div className={styles.installCommand}>
    <p><Terminal size={14} aria-hidden="true" /> Install from your terminal</p>
    <div className={styles.commandRow}><code>{BLUE_INSTALL_COMMAND}</code><button type="button" onClick={copy} aria-label={status === "copied" ? "Install command copied" : "Copy Blue extension install command"}>{status === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}<span>{status === "copied" ? "Copied" : "Copy"}</span></button></div>
    <small role="status">{status === "unavailable" ? "Could not copy automatically. Select the command above and copy it manually." : "Requires Visual Studio Code with the “code” command available in your terminal."}</small>
  </div>;
}
