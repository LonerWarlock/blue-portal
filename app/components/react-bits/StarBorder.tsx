'use client';

// Adapted from David Haz / React Bits. MIT + Commons Clause; see LICENSE.md.
// https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Animations/StarBorder/StarBorder.tsx
import type { CSSProperties, PropsWithChildren } from 'react';
import styles from './PricingEffects.module.css';

// A decorative div, not the upstream default button: cards contain their own CTAs.
export default function StarBorder({ children, className = '', color = '#82abff', speed = '12s', thickness = 1 }:
  PropsWithChildren<{ className?: string; color?: string; speed?: string; thickness?: number }>) {
  const glow = { background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed };
  return <div className={`${styles.starBorder} ${className}`} style={{ padding: thickness, '--edge-color': color } as CSSProperties}>
    <div aria-hidden="true" className={styles.gradientBottom} style={glow} />
    <div aria-hidden="true" className={styles.gradientTop} style={glow} />
    <div className={styles.inner}>{children}</div>
  </div>;
}
