"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "../contexts/ThemeContext";
import styles from "./PremiumLanding.module.css";

const Scene = dynamic(() => import("./BlueCoreScene"), { ssr: false });
class CoreBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function BlueCore() {
  const stage = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [allowed, setAllowed] = useState(false);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [rendered, setRendered] = useState(false);
  const onReady = useCallback(() => setRendered(true), []);
  const onUnavailable = useCallback(() => setUnavailable(true), []);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: Function; removeEventListener?: Function } }).connection;
    const update = () => setAllowed(!motion.matches && !connection?.saveData);
    const visibility = () => setVisible(!document.hidden);
    update(); visibility(); motion.addEventListener("change", update);
    connection?.addEventListener?.("change", update); document.addEventListener("visibilitychange", visibility);
    return () => { motion.removeEventListener("change", update); connection?.removeEventListener?.("change", update); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (!stage.current) return;
    if (!("IntersectionObserver" in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(stage.current); return () => observer.disconnect();
  }, []);
  const animate = allowed && inView && visible && !paused && !unavailable;
  useEffect(() => { if (!animate) setRendered(false); }, [animate]);
  return (
    <div className={styles.core} data-blue-core data-animation={unavailable ? "unavailable" : !allowed ? "static" : paused ? "paused" : animate ? "animated" : "offscreen"}>
      <div ref={stage} className={styles.coreArt} aria-hidden="true" data-rendered={animate && rendered}>
        <div className={styles.coreOrbit} />
        <div className={styles.coreGround} />
        <Image className={styles.coreFallback} src="/images/blue-symbol.png" alt="" width={1280} height={1280} unoptimized priority />
        {animate && <CoreBoundary onUnavailable={onUnavailable}><Scene dark={resolvedTheme === "dark"} onReady={onReady} onUnavailable={onUnavailable} /></CoreBoundary>}
      </div>
      <div className={styles.coreFooter}>
        <span><span className={styles.coreDot} /> THE BLUE CORE <span className={styles.coreFootnote}>/ Original brand artwork</span></span>
        {allowed && !unavailable && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Play Blue Core animation" : "Pause Blue Core animation"} aria-pressed={paused} className={styles.motionButton}>{paused ? <Play size={14} /> : <Pause size={14} />}<span>{paused ? "Play" : "Pause"}</span></button>}
      </div>
    </div>
  );
}
