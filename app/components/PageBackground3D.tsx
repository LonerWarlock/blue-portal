"use client";

import { useEffect, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

type Theme = "privacy" | "terms" | "refund";

interface Item {
  x: number;
  y: number;
  z: number;
  type: "word" | "symbol" | "badge";
  color: string;
  duration: number;
  delay: number;
  content: string;
  fontSize: number;
}

const THEMES: Record<Theme, { colors: string[]; words: string[]; symbols: string[]; badges: string[] }> = {
  privacy: {
    colors: [
      "rgba(59, 130, 246, 0.5)",
      "rgba(34, 211, 238, 0.4)",
      "rgba(56, 189, 248, 0.4)",
      "rgba(14, 165, 233, 0.35)",
    ],
    words: ["privacy", "data", "GDPR", "secure", "encrypted", "consent", "protected", "rights"],
    symbols: ["[#]", "[+]", "[✓]", "[x]"],
    badges: ["encrypted", "secured", "private", "trusted"],
  },
  terms: {
    colors: [
      "rgba(99, 102, 241, 0.5)",
      "rgba(139, 92, 246, 0.45)",
      "rgba(168, 85, 247, 0.4)",
      "rgba(124, 58, 237, 0.35)",
    ],
    words: ["terms", "legal", "binding", "governed", "liable", "rules", "agreement", "jurisdiction"],
    symbols: ["\u00a7", "\u00b6", "\u00a9", "\u2122"],
    badges: ["terms", "legal", "binding", "governed"],
  },
  refund: {
    colors: [
      "rgba(34, 211, 238, 0.45)",
      "rgba(168, 85, 247, 0.4)",
      "rgba(236, 72, 153, 0.35)",
      "rgba(20, 184, 166, 0.4)",
    ],
    words: ["refund", "wallet", "credit", "cancel", "billing", "invoice", "policy", "token"],
    symbols: ["\u20b9", "$", "\u00a2", "%"],
    badges: ["refund", "cancel", "credit", "wallet"],
  },
};

function generateItems(theme: Theme): Item[] {
  const t = THEMES[theme];
  const items: Item[] = [];
  const types: Item["type"][] = ["word", "word", "symbol", "badge", "word", "badge", "symbol", "word"];
  for (let i = 0; i < 24; i++) {
    const type = types[i % types.length];
    let content = "";
    let fontSize = 12;
    if (type === "word") {
      content = t.words[i % t.words.length];
      fontSize = 11 + Math.floor(Math.random() * 5);
    } else if (type === "symbol") {
      content = t.symbols[i % t.symbols.length];
      fontSize = 18 + Math.floor(Math.random() * 12);
    } else {
      content = t.badges[i % t.badges.length];
      fontSize = 10 + Math.floor(Math.random() * 3);
    }
    items.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 120 - 60,
      type,
      color: t.colors[i % t.colors.length],
      duration: 12 + Math.random() * 22,
      delay: Math.random() * 14,
      content,
      fontSize,
    });
  }
  return items;
}

function Item3D({
  item,
  xSpring,
  ySpring,
}: {
  item: Item;
  xSpring: MotionValue<number>;
  ySpring: MotionValue<number>;
}) {
  const xOffset = useTransform(xSpring, [-0.5, 0.5], [-item.z * 0.5, item.z * 0.5]);
  const yOffset = useTransform(ySpring, [-0.5, 0.5], [-item.z * 0.5, item.z * 0.5]);
  const pos = { left: `${item.x}%`, top: `${item.y}%`, x: xOffset, y: yOffset, z: item.z };

  switch (item.type) {
    case "word":
      return (
        <motion.div className="pointer-events-none absolute" style={pos}>
          <motion.span
            className="font-mono font-semibold tracking-wider uppercase block"
            style={{
              fontSize: `${item.fontSize}px`,
              color: item.color,
              textShadow: `0 0 22px ${item.color}`,
            }}
            animate={{ rotateX: [0, 360], opacity: [0.4, 0.9, 0.4] }}
            transition={{
              duration: item.duration,
              repeat: Infinity,
              ease: "linear",
              delay: item.delay,
            }}
          >
            {item.content}
          </motion.span>
        </motion.div>
      );

    case "symbol":
      return (
        <motion.div
          className="pointer-events-none absolute flex items-center justify-center"
          style={{ ...pos, width: 48, height: 48, marginLeft: -24, marginTop: -24 }}
        >
          <motion.span
            className="font-mono font-bold block text-center leading-none"
            style={{
              fontSize: `${item.fontSize}px`,
              color: item.color,
              textShadow: `0 0 30px ${item.color}`,
            }}
            animate={{ rotateZ: [0, 360], scale: [1, 1.15, 1] }}
            transition={{
              duration: item.duration * 0.7,
              repeat: Infinity,
              ease: "linear",
              delay: item.delay,
            }}
          >
            {item.content}
          </motion.span>
        </motion.div>
      );

    case "badge":
      return (
        <motion.div className="pointer-events-none absolute" style={pos}>
          <motion.div
            className="rounded-full border px-3 py-1 font-mono text-xs"
            style={{
              fontSize: `${item.fontSize}px`,
              borderColor: item.color,
              color: item.color,
              backgroundColor: item.color.replace(/[\d.]+\)$/, "0.06)"),
              boxShadow: `0 0 16px ${item.color.replace(/[\d.]+\)/, "0.08")}`,
            }}
            animate={{ y: [0, -8, 0] }}
            transition={{
              duration: 3.5 + Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: item.delay,
            }}
          >
            {item.content}
          </motion.div>
        </motion.div>
      );
  }
}

export default function PageBackground3D({ theme }: { theme: Theme }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const xSpring = useSpring(mouseX, { stiffness: 20, damping: 10 });
  const ySpring = useSpring(mouseY, { stiffness: 20, damping: 10 });
  const items = useMemo(() => generateItems(theme), [theme]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth - 0.5);
      mouseY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ perspective: "1200px" }}>
      {items.map((item, i) => (
        <Item3D key={i} item={item} xSpring={xSpring} ySpring={ySpring} />
      ))}
    </div>
  );
}
