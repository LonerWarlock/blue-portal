"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

const LINES = [
  { prefix: "$", color: "text-green-400", text: "Build a contact form and save responses to Postgres" },
  { prefix: ">", color: "text-blue-400", text: "Planning... Outlining file changes and code blocks required" },
  { prefix: ">", color: "text-blue-400", text: "Creating components/ContactForm.tsx..." },
  { prefix: ">", color: "text-blue-400", text: "Creating api/contact.ts..." },
  { prefix: "\u2192", color: "text-purple-400", text: "Running tests... Checking for errors" },
  { prefix: "\u2713", color: "text-green-400", text: "Tests passed. No syntax errors. Ready for review." },
];

export default function TerminalCard3D() {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rawRotX = useTransform(mouseY, [-0.5, 0.5], [5, -5]);
  const rawRotY = useTransform(mouseX, [-0.5, 0.5], [-5, 5]);
  const rotX = useSpring(rawRotX, { stiffness: 250, damping: 25 });
  const rotY = useSpring(rawRotY, { stiffness: 250, damping: 25 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: rotX,
        rotateY: rotY,
        transformStyle: "preserve-3d",
      }}
      className="rounded-2xl glass border border-gray-800/80 overflow-hidden shadow-2xl transition-shadow duration-500 hover:shadow-blue-500/10"
    >
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800/80 bg-gray-900/50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-gray-500 ml-3 font-mono">blue-agent ~/project</span>
        <div className="ml-auto flex items-center gap-3 text-gray-600">
          <i className="fa-solid fa-bolt text-xs" />
          <span className="text-[10px] font-mono">Agent Loop</span>
        </div>
      </div>
      <div className="p-6 font-mono text-sm space-y-3">
        {LINES.map((line, i) => (
          <motion.div
            key={i}
            className="flex items-start gap-3"
            style={{ transformStyle: "preserve-3d" }}
          >
            <span className={`${line.color} shrink-0`} style={{ transform: "translateZ(12px)" }}>
              {line.prefix}
            </span>
            <span className="text-gray-400" style={{ transform: "translateZ(8px)" }}>
              {line.text}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
