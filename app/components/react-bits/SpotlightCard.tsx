'use client';

// Adapted from David Haz / React Bits. MIT + Commons Clause; see LICENSE.md.
// https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Components/SpotlightCard/SpotlightCard.tsx
import { useEffect, useRef, type CSSProperties, type PropsWithChildren, type MouseEvent } from 'react';
import styles from './PricingEffects.module.css';

export default function SpotlightCard({ children, className = '', spotlightColor = 'rgba(100, 150, 255, 0.16)' }:
  PropsWithChildren<{ className?: string; spotlightColor?: string }>) {
  const divRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const point = useRef({ x: 0, y: 0 });
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;
    point.current = { x: event.clientX, y: event.clientY };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const card = divRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${point.current.x - rect.left}px`);
      card.style.setProperty('--mouse-y', `${point.current.y - rect.top}px`);
    });
  };
  return <div ref={divRef} onMouseMove={handleMouseMove} className={`${styles.spotlight} ${className}`}
    style={{ '--spotlight-color': spotlightColor } as CSSProperties}>{children}</div>;
}
