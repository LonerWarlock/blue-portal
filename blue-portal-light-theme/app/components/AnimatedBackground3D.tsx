"use client";

import { useEffect, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

type ShapeType = "braces" | "tag" | "agent" | "code";

interface ShapeConfig {
  x: number;
  y: number;
  z: number;
  type: ShapeType;
  color: string;
  duration: number;
  delay: number;
  text: string;
  fontSize: number;
}

const COLORS = [
  "rgba(59, 130, 246, 0.55)",
  "rgba(99, 102, 241, 0.50)",
  "rgba(139, 92, 246, 0.45)",
  "rgba(34, 211, 238, 0.35)",
  "rgba(168, 85, 247, 0.40)",
  "rgba(56, 189, 248, 0.40)",
];

const BRACES = ["{ }", "{ blue }", "{ code }", "{ agent }", "{ ai }", "{* *}"];
const TAGS = ["<Blue />", "<Agent />", "<Code />", "< />", "</AI>", "<Build />"];
const LINES = [
  "npm run dev",
  "git push",
  "const Blue =",
  "function ai()",
  "import React",
  "npx create",
  "export default",
  "await agent",
];

const TYPES: ShapeType[] = [
  "braces", "tag", "agent", "code",
  "tag", "code", "braces", "agent",
  "agent", "braces", "code", "tag",
  "code", "agent", "tag", "braces",
  "braces", "code", "agent", "tag",
  "tag", "braces", "code", "agent",
];

function generateShapes(): ShapeConfig[] {
  const counters = { braces: 0, tag: 0, agent: 0, code: 0 };
  return TYPES.map((type) => {
    counters[type]++;
    let text = "";
    let fontSize = 12;
    if (type === "braces") {
      text = BRACES[counters.braces % BRACES.length];
      fontSize = 16 + Math.floor(Math.random() * 10);
    } else if (type === "tag") {
      text = TAGS[counters.tag % TAGS.length];
      fontSize = 10 + Math.floor(Math.random() * 3);
    } else if (type === "code") {
      text = LINES[counters.code % LINES.length];
      fontSize = 10 + Math.floor(Math.random() * 3);
    }
    return {
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 120 - 60,
      type,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      duration: 12 + Math.random() * 22,
      delay: Math.random() * 14,
      text,
      fontSize,
    };
  });
}

function ShapeItem({
  shape,
  xSpring,
  ySpring,
}: {
  shape: ShapeConfig;
  xSpring: MotionValue<number>;
  ySpring: MotionValue<number>;
}) {
  const xOffset = useTransform(xSpring, [-0.5, 0.5], [-shape.z * 0.5, shape.z * 0.5]);
  const yOffset = useTransform(ySpring, [-0.5, 0.5], [-shape.z * 0.5, shape.z * 0.5]);

  const posStyle = {
    left: `${shape.x}%`,
    top: `${shape.y}%`,
    x: xOffset,
    y: yOffset,
    z: shape.z,
  };

  switch (shape.type) {
    case "braces":
      return (
        <motion.div className="pointer-events-none absolute" style={posStyle}>
          <motion.span
            className="font-mono font-bold tracking-tighter block"
            style={{
              fontSize: `${shape.fontSize}px`,
              color: shape.color,
              textShadow: `0 0 24px ${shape.color}`,
            }}
            animate={{ rotateX: [0, 360], rotateY: [0, 360] }}
            transition={{
              duration: shape.duration,
              repeat: Infinity,
              ease: "linear",
              delay: shape.delay,
            }}
          >
            {shape.text}
          </motion.span>
        </motion.div>
      );

    case "tag":
      return (
        <motion.div className="pointer-events-none absolute" style={posStyle}>
          <motion.div
            className="rounded-full border px-3 py-1 font-mono"
            style={{
              fontSize: `${shape.fontSize}px`,
              borderColor: shape.color,
              color: shape.color,
              backgroundColor: shape.color.replace(/[\d.]+\)$/, "0.06)"),
              boxShadow: `0 0 18px ${shape.color.replace(/[\d.]+\)/, "0.08")}`,
            }}
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 3.5 + Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: shape.delay,
            }}
          >
            {shape.text}
          </motion.div>
        </motion.div>
      );

    case "agent":
      return (
        <motion.div
          className="pointer-events-none absolute flex items-center justify-center"
          style={{ ...posStyle, width: 44, height: 44, marginLeft: -22, marginTop: -22 }}
        >
          <motion.div
            className="rounded-full absolute"
            style={{
              width: 8,
              height: 8,
              backgroundColor: shape.color,
              boxShadow: `0 0 20px ${shape.color}`,
            }}
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: shape.delay,
            }}
          />
          <motion.div
            className="rounded-full border absolute"
            style={{
              width: 26,
              height: 26,
              borderColor: shape.color,
              borderWidth: 1.5,
              opacity: 0.7,
              boxShadow: `0 0 10px ${shape.color.replace(/[\d.]+\)/, "0.1")}`,
            }}
            animate={{ rotateZ: [0, 360] }}
            transition={{
              duration: shape.duration * 0.3,
              repeat: Infinity,
              ease: "linear",
              delay: shape.delay,
            }}
          />
          <motion.div
            className="rounded-full border absolute"
            style={{
              width: 42,
              height: 42,
              borderColor: shape.color.replace(/[\d.]+\)$/, "0.25)"),
              borderWidth: 1,
              opacity: 0.4,
            }}
            animate={{ rotateZ: [360, 0] }}
            transition={{
              duration: shape.duration * 0.5,
              repeat: Infinity,
              ease: "linear",
              delay: shape.delay,
            }}
          />
        </motion.div>
      );

    case "code":
      return (
        <motion.div className="pointer-events-none absolute" style={posStyle}>
          <motion.div
            className="font-mono rounded-md border-l-2 px-3 py-1.5"
            style={{
              fontSize: `${shape.fontSize}px`,
              borderLeftColor: shape.color,
              borderColor: shape.color.replace(/[\d.]+\)$/, "0.12)"),
              borderWidth: 1,
              borderTopWidth: 1,
              borderRightWidth: 1,
              borderBottomWidth: 1,
              color: shape.color,
              backgroundColor: shape.color.replace(/[\d.]+\)$/, "0.04)"),
              boxShadow: `0 0 12px ${shape.color.replace(/[\d.]+\)/, "0.05")}`,
              whiteSpace: "nowrap",
            }}
            animate={{ x: [0, 5, 0] }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: shape.delay,
            }}
          >
            {shape.text}
          </motion.div>
        </motion.div>
      );
  }
}

export default function AnimatedBackground3D() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const xSpring = useSpring(mouseX, { stiffness: 20, damping: 10 });
  const ySpring = useSpring(mouseY, { stiffness: 20, damping: 10 });
  const shapes = useMemo(() => generateShapes(), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth - 0.5);
      mouseY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ perspective: "1200px", zIndex: -1 }}>
      {shapes.map((shape, i) => (
        <ShapeItem key={i} shape={shape} xSpring={xSpring} ySpring={ySpring} />
      ))}
    </div>
  );
}
