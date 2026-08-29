"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Live Blue Agent workspace demo — replaces the static "Plans / Writes Code /
// Runs Terminals" callout with a simulated agent run inside the same window
// chrome used elsewhere on the site (see HeroConsole / TerminalCard3D).
// Pure frontend simulation: no network calls, no external state.

type Tone = "command" | "action" | "success";
type Stage = "plan" | "code" | "test" | "done";

interface Line {
  id: string;
  prefix: string;
  text: string;
  tone: Tone;
  stage: Stage;
  status: string;
}

const LINES: Line[] = [
  { id: "cmd", prefix: "$", text: 'blue "Fix the authentication validation bug"', tone: "command", stage: "plan", status: "Working" },
  { id: "a1", prefix: ">", text: "Analyzing project...", tone: "action", stage: "plan", status: "Analyzing" },
  { id: "a2", prefix: "\u2713", text: "Scanned 24 files", tone: "success", stage: "plan", status: "Analyzing" },
  { id: "p1", prefix: ">", text: "Creating implementation plan...", tone: "action", stage: "plan", status: "Planning" },
  { id: "p2", prefix: "\u2713", text: "Found 3 files to modify", tone: "success", stage: "plan", status: "Planning" },
  { id: "c1", prefix: ">", text: "Writing changes...", tone: "action", stage: "code", status: "Coding" },
  { id: "c2", prefix: "\u2713", text: "src/auth/login.ts", tone: "success", stage: "code", status: "Coding" },
  { id: "c3", prefix: "\u2713", text: "src/auth/validation.ts", tone: "success", stage: "code", status: "Coding" },
  { id: "t1", prefix: ">", text: "Running tests...", tone: "action", stage: "test", status: "Testing" },
  { id: "t2", prefix: "$", text: "npm test", tone: "command", stage: "test", status: "Testing" },
  { id: "t3", prefix: "\u2713", text: "42 tests passed", tone: "success", stage: "test", status: "Testing" },
  { id: "t4", prefix: "\u2713", text: "No lint errors", tone: "success", stage: "test", status: "Testing" },
  { id: "d1", prefix: "\u2713", text: "Task completed", tone: "success", stage: "done", status: "Completed" },
];

const STAGES: { id: Stage; label: string }[] = [
  { id: "plan", label: "PLAN" },
  { id: "code", label: "CODE" },
  { id: "test", label: "TEST" },
  { id: "done", label: "DONE" },
];

const LINE_DELAY_MS = 550;
const RESTART_DELAY_MS = 2600;

function toneClass(tone: Tone) {
  if (tone === "command") return "text-ink";
  if (tone === "success") return "text-[var(--success)]";
  return "text-brand";
}

export default function AgentLiveDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleCount(LINES.length);
      return;
    }

    if (visibleCount < LINES.length) {
      timeoutRef.current = setTimeout(() => {
        setVisibleCount((c) => c + 1);
      }, LINE_DELAY_MS);
    } else {
      timeoutRef.current = setTimeout(() => {
        setVisibleCount(0);
      }, RESTART_DELAY_MS);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visibleCount, prefersReducedMotion]);

  const current = LINES[Math.max(visibleCount - 1, 0)];
  const isComplete = visibleCount >= LINES.length;
  const statusLabel = isComplete ? "Completed" : current?.status ?? "Working";
  const activeStage = isComplete ? "done" : current?.stage ?? "plan";
  const activeStageIndex = STAGES.findIndex((s) => s.id === activeStage);

  return (
    <div className="panel overflow-hidden shadow-md">
      {/* Title bar — matches HeroConsole / TerminalCard3D chrome */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-line bg-paper-alt">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-line-strong" />
          <div className="w-2.5 h-2.5 rounded-full bg-line-strong" />
          <div className="w-2.5 h-2.5 rounded-full bg-line-strong" />
        </div>
        <span className="text-xs text-ink-faint ml-3 font-mono truncate">blue-agent ~/project</span>

        <div className="ml-auto flex items-center gap-1.5 text-xs font-mono shrink-0">
          {isComplete ? (
            <span className="flex items-center gap-1.5 text-[var(--success)]">
              <i className="fa-solid fa-circle-check text-[10px]" />
              <span className="hidden sm:inline">{statusLabel}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-brand">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand" />
              </span>
              <span className="hidden sm:inline">{statusLabel}</span>
            </span>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div className="p-5 sm:p-6 font-mono text-[13px] sm:text-sm space-y-2.5 min-h-[280px] sm:min-h-[320px]">
        <AnimatePresence initial={false}>
          {LINES.slice(0, visibleCount).map((line, i) => {
            const isLast = i === visibleCount - 1 && !isComplete;
            return (
              <motion.div
                key={`${line.id}-${visibleCount > 0 ? "run" : "idle"}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-start gap-3 break-words"
              >
                <span className={`${toneClass(line.tone)} shrink-0 w-4`}>{line.prefix}</span>
                <span className={line.tone === "command" ? "text-ink" : "text-ink-muted"}>
                  {line.text}
                  {isLast && (
                    <span className="inline-block w-[7px] h-[1em] bg-brand ml-1 align-middle animate-pulse" />
                  )}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Mini activity bar */}
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 px-5 sm:px-6 py-3 border-t border-line bg-paper-alt text-[11px] font-mono">
        {STAGES.map((stage, i) => {
          const stageDone = i < activeStageIndex || (isComplete && stage.id === "done");
          const stageActive = i === activeStageIndex && !isComplete ? true : isComplete && stage.id === "done";
          return (
            <div key={stage.id} className="flex items-center gap-2">
              <span
                className={
                  stageDone || stageActive
                    ? "text-brand font-semibold"
                    : "text-ink-faint"
                }
              >
                {stage.label}
                {stageDone && !stageActive ? " \u2713" : ""}
              </span>
              {i < STAGES.length - 1 && <span className="text-ink-faint">&rarr;</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
