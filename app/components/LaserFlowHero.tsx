"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { Component, useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import styles from "./LaserFlowHero.module.css";

// Keep Three.js out of the initial homepage bundle and every other route.
const LaserFlow = dynamic(() => import("./react-bits/LaserFlow"), { ssr: false });

class AnimationBoundary extends Component<{
  children: ReactNode;
  onUnavailable: () => void;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function LaserFlowHero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const revealFrame = useRef(0);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [finePointer, setFinePointer] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [webglReady, setWebglReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dpr, setDpr] = useState(1);
  const onUnavailable = useCallback(() => setUnavailable(true), []);

  const resetReveal = useCallback(() => {
    cancelAnimationFrame(revealFrame.current);
    const stage = stageRef.current;
    if (!stage) return;
    stage.dataset.reveal = "false";
    stage.style.removeProperty("--reveal-x");
    stage.style.removeProperty("--reveal-y");
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const mobile = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setReducedMotion(motion.matches);
      setFinePointer(pointer.matches);
      setDpr(mobile.matches ? 0.75 : Math.min(window.devicePixelRatio || 1, 1.25));
      resetReveal();
    };
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setSaveData(connection?.saveData === true);
    update();
    setReady(true);
    for (const query of [motion, pointer, mobile]) query.addEventListener("change", update);
    return () => {
      for (const query of [motion, pointer, mobile]) query.removeEventListener("change", update);
      cancelAnimationFrame(revealFrame.current);
    };
  }, [resetReveal]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!("IntersectionObserver" in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Check before importing the renderer. Do not leave a probe GPU context alive.
  useEffect(() => {
    if (!ready || !inView || webglReady || reducedMotion || saveData) return;
    const canvas = document.createElement("canvas");
    try {
      const gl = canvas.getContext("webgl2", { powerPreference: "low-power" });
      if (!gl) { setUnavailable(true); return; }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      setWebglReady(true);
    } catch { setUnavailable(true); }
  }, [ready, inView, webglReady, reducedMotion, saveData]);

  function reveal(event: PointerEvent<HTMLDivElement>) {
    if (!finePointer || reducedMotion || saveData || event.pointerType !== "mouse") return;
    const stage = stageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    cancelAnimationFrame(revealFrame.current);
    revealFrame.current = requestAnimationFrame(() => {
      stage.style.setProperty("--reveal-x", `${x}px`);
      stage.style.setProperty("--reveal-y", `${y}px`);
      stage.dataset.reveal = "true";
    });
  }

  const canAnimate = ready && webglReady && !reducedMotion && !saveData && !unavailable;
  // Release the renderer outside the viewport instead of relying solely on
  // the upstream shader's observer. Re-entry reuses the cached module.
  const animate = canAnimate && inView && !paused;
  const mode = !ready ? "pending" : reducedMotion ? "reduced-motion" : saveData ? "save-data" : unavailable ? "unavailable" : paused ? "paused" : canAnimate && !inView ? "offscreen" : animate ? "animated" : "pending";

  return (
    <figure className={styles.figure} data-blue-laser-figure="true" aria-labelledby="blue-workspace-caption">
      <div
        ref={stageRef}
        className={styles.stage}
        data-blue-laser-hero="true"
        data-animation={mode}
        data-reveal="false"
        data-hover-capable={finePointer}
        onPointerMove={reveal}
        onPointerLeave={resetReveal}
        onPointerCancel={resetReveal}
        aria-hidden="true"
      >
        <div className={styles.staticLight} />
        {animate && (
          <div className={styles.laser}>
            <AnimationBoundary onUnavailable={onUnavailable}>
              <LaserFlow
                color="#5B9BD5"
                backgroundColor="#101925"
                falloffStart={0.5}
                horizontalBeamOffset={0}
                verticalBeamOffset={-0.5}
                horizontalSizing={1.05}
                verticalSizing={1.6}
                flowSpeed={0.25}
                fogIntensity={0.38}
                wispDensity={1.2}
                wispIntensity={4}
                mouseTiltStrength={0}
                dpr={dpr}
                onUnavailable={onUnavailable}
              />
            </AnimationBoundary>
          </div>
        )}
        <div className={styles.launchGhost} data-blue-launch-static="true">
          <div className={styles.launchCopy}><span>Blue Desktop.</span><span>Launching soon</span></div>
        </div>
        <div className={styles.spotlight} data-blue-launch-reveal="true">
          <div className={styles.launchCopy}><span>Blue Desktop.</span><span>Launching soon</span></div>
        </div>
        <div className={styles.separator} data-blue-laser-separator="true" />
      </div>
      <div className={styles.preview} data-blue-desktop-preview="true">
        <Image src="/images/blue-desktop-preview.png" alt="Blue Desktop's current interface, with New chat, Connections, Full Access, UI Max and Attach file controls. Empty preview account." width={1440} height={900} unoptimized draggable={false} />
      </div>
      {canAnimate && (
        <div className={styles.animationControls}>
          <button type="button" className={`${styles.toggle} ${styles.animationControl}`} aria-label={paused ? "Play animation" : "Pause animation"} title={paused ? "Play animation" : "Pause animation"} aria-pressed={paused} onClick={() => { resetReveal(); setPaused(value => !value); }}>
            {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
            <span className={styles.toggleLabel}>{paused ? "Play animation" : "Pause animation"}</span>
          </button>
        </div>
      )}
      <figcaption id="blue-workspace-caption" className={styles.caption}>
        <span>Blue Desktop <span className={styles.captionDetail}>/ Launching soon · Product preview</span></span>
        <div className={styles.captionActions}>
          {finePointer && !reducedMotion && !saveData && <span className={styles.hoverHint}>Move your cursor to explore</span>}
        </div>
      </figcaption>
    </figure>
  );
}
