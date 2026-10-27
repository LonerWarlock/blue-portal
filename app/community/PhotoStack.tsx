"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import type { heroPhotos as HeroPhotos } from '@/lib/community';
import styles from './community.module.css';

export default function PhotoStack({ photos }: { photos: typeof HeroPhotos }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const rotating = playing && !reducedMotion && !interacting;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!rotating || photos.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive(index => (index + 1) % photos.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [rotating, photos.length]);

  function change(delta: number) {
    setPlaying(false);
    setActive(index => (index + delta + photos.length) % photos.length);
  }

  return (
    <div className={styles.stackArea} role="region" aria-roledescription="carousel" aria-label="Community photo highlights"
      onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false); }}>
      <div className={styles.photoStack}>
        {[2, 1, 0].map(depth => {
          const item = photos[(active + depth) % photos.length];
          return <figure key={`${depth}-${item.photo.id}`} className={`${styles.polaroid} ${depth === 0 ? styles.frontPhoto : styles.backPhoto}`}
            data-depth={depth} aria-hidden={depth !== 0}>
            <div className={styles.polaroidImage}>
              <Image src={item.photo.src} alt={depth === 0 ? item.photo.alt : ''} fill unoptimized
                sizes="(max-width: 640px) 82vw, 530px" priority={depth === 0} />
            </div>
            <figcaption><span>{item.caption}</span><small>{item.detail}</small></figcaption>
          </figure>;
        })}
      </div>
      <div className={styles.stackControls}>
        <button type="button" aria-label="Previous community photo" onClick={() => change(-1)} className={styles.iconButton}><ArrowLeft size={17} aria-hidden="true" /></button>
        <span className={styles.photoCounter} aria-live={rotating ? 'off' : 'polite'}>{String(active + 1).padStart(2, '0')} <span>/ {String(photos.length).padStart(2, '0')}</span></span>
        <button type="button" aria-label="Next community photo" onClick={() => change(1)} className={styles.iconButton}><ArrowRight size={17} aria-hidden="true" /></button>
        {!reducedMotion && <button type="button" aria-label={playing ? 'Pause photo rotation' : 'Play photo rotation'} aria-pressed={playing}
          onClick={() => setPlaying(value => !value)} className={`${styles.iconButton} ${styles.playButton}`}>
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        </button>}
      </div>
    </div>
  );
}
