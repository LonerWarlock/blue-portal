"use client";

import { Expand, LoaderCircle, Monitor, Shapes, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import styles from "./DesktopShowcase.module.css";
import TeamWorkspacePreview from "./TeamWorkspacePreview";

export default function DesktopShowcase() {
  const { resolvedTheme } = useTheme();
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const [demoDocument, setDemoDocument] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const windowRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const demoHtml = demoDocument.replace('<html lang="en">', `<html lang="en" data-preview-theme="${resolvedTheme}">`);
  const modalHtml = demoHtml.replace('<html lang="en"', `<html lang="en" data-preview-view="${selected === 2 ? "models" : "workspace"}"`);

  useEffect(() => {
    const element = windowRef.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) { setNearViewport(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearViewport(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!(nearViewport || open) || demoDocument) return;
    const controller = new AbortController();
    setLoadError(false);
    fetch("/demos/blue-desktop/index.html?v=0.1.19-ui4", { credentials: "omit", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Preview unavailable"); return response.text(); })
      .then(setDemoDocument).catch(error => { if (error.name !== "AbortError") setLoadError(true); });
    return () => controller.abort();
  }, [nearViewport, open, demoDocument, retry]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; openButtonRef.current?.focus({ preventScroll: true }); };
  }, [open]);

  function enlarge() { setOpen(true); dialogRef.current?.showModal(); }
  function chooseView(index: number) {
    setSelected(index);
    if (index !== 0) frameRef.current?.contentWindow?.postMessage({ type: "blue-demo-view", view: index === 2 ? "models" : "workspace" }, "*");
  }
  function loading() {
    return <div className={styles.loading} role="status">{loadError ? <><span>The interactive preview could not load.</span><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></> : <><LoaderCircle size={20} aria-hidden="true" /><span>Loading Blue’s example workspace…</span></>}</div>;
  }
  return <div className={styles.showcase} data-blue-desktop-showcase>
    <div className={styles.toolbar}>
      <div role="group" aria-label="Desktop preview views" className={styles.tabs}>
          <button type="button" aria-pressed={selected === 0} onClick={() => chooseView(0)}><UsersRound size={15} aria-hidden="true" />Team workspace</button>
          <button type="button" aria-pressed={selected === 1} onClick={() => chooseView(1)}><Monitor size={15} aria-hidden="true" />Try Blue Desktop</button>
          <button type="button" aria-pressed={selected === 2} onClick={() => chooseView(2)}><Shapes size={15} aria-hidden="true" />Model choice</button>
      </div>
      <span className={styles.availability}>Now available</span>
    </div>
    <div className={styles.stage}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <div ref={windowRef} className={styles.mainWindow}>
          {selected === 0 ? <TeamWorkspacePreview variant="showcase" /> : demoDocument ? <iframe ref={frameRef} className={styles.nativeFrame} title="Interactive Blue Desktop preview — example data only" srcDoc={demoHtml} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" onLoad={() => { if (selected === 2) frameRef.current?.contentWindow?.postMessage({ type: "blue-demo-view", view: "models" }, "*"); }} /> : loading()}
      </div>
      <span className={styles.stageLabel}>BLUE DESKTOP / INTERACTIVE PREVIEW</span>
    </div>
    <div className={styles.details}>
      <div><p>{selected === 0 ? <><strong>Blue’s Team workspace.</strong> See the conversation, specialist activity and the work Blue coordinates in one desktop view.</> : selected === 1 ? <><strong>Blue’s interface. Yours to explore.</strong> Switch chats, answer a question, or send an example task. With Multi-agent on, open an agent chat to see its example work.</> : <><strong>Your choice of model.</strong> Try Blue’s model picker. Selecting a model updates this preview only; it does not send a model request.</>}</p><small>{selected === 0 ? "Illustrative Team workspace with example activity. No AI calls, credits, files or account connections." : "Illustrative example data. No AI calls, credits, files or account connections. This is not a live coding session."}</small>{selected !== 0 && <small className={styles.mobileHint}>Use the menu button inside the demo to switch example chats. Agent details open as a full-width panel.</small>}</div>
      <button ref={openButtonRef} type="button" className={styles.fullSize} onClick={enlarge}><Expand size={15} aria-hidden="true" /> Open full-size demo</button>
    </div>
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="desktop-preview-dialog-title" onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
      <div className={styles.dialogHeader}><h3 id="desktop-preview-dialog-title">{selected === 0 ? "Blue Team workspace / preview" : "Blue Desktop / Interactive preview"}</h3><button type="button" autoFocus aria-label="Close Desktop preview" onClick={() => dialogRef.current?.close()}><X size={20} aria-hidden="true" /></button></div>
      {open && <div className={styles.dialogFrame}>{selected === 0 ? <TeamWorkspacePreview variant="showcase" /> : demoDocument ? <iframe title="Full-size Blue Desktop preview — example data only" srcDoc={modalHtml} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" /> : loading()}</div>}
      <p className={styles.dialogCaption}>{selected === 0 ? "Illustrative Team workspace. Example activity only; no agents are running." : "Blue Desktop example data. Scripted responses only; no AI request or account access."}</p>
    </dialog>
  </div>;
}
