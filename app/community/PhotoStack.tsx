"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import type { heroPhotos as HeroPhotos } from '@/lib/community';
import { communityImageLoader, preloadNearbyPhotos } from '@/lib/communityImageLoader';
import CommunityImage from './CommunityImage';
import styles from './community.module.css';

export default function PhotoStack({ photos }: { photos: typeof HeroPhotos }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [pending, setPending] = useState(false);
  const requested = useRef(0);
  const selection = useRef(0);
  const rotating = playing && !reducedMotion && !interacting;

  const change = useCallback((delta: number, manual = true) => {
    if (manual) setPlaying(false);
    const next = (requested.current + delta + photos.length) % photos.length;
    requested.current = next;
    const token = ++selection.current;
    setPending(true);
    // Keep the current photograph visible while its successor is prepared.
    void communityImageLoader.preload(photos[next].photo.src).catch(() => {}).then(() => {
      if (selection.current !== token) return;
      setActive(next);
      setPending(false);
    });
  }, [photos]);

  useEffect(() => () => { selection.current++; }, []);

  useEffect(() => {
    preloadNearbyPhotos([photos[(active + 1) % photos.length].photo.src]);
  }, [active, photos]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!rotating || pending || photos.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) change(1, false);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [rotating, pending, photos.length, change]);

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
              <CommunityImage src={item.photo.src} thumbnail={item.photo.thumbnail} alt={depth === 0 ? item.photo.alt : ''}
                sizes="(max-width: 640px) 82vw, 530px" priority={depth === 0} retryable={depth === 0} />
            </div>
            <figcaption><span>{item.caption}</span><small>{item.detail}</small></figcaption>
          </figure>;
        })}
      </div>
      <div className={styles.stackControls}>
        <button type="button" aria-label="Previous community photo" onClick={() => change(-1)} className={styles.iconButton}><ArrowLeft size={17} aria-hidden="true" /></button>
        <span className={styles.photoCounter} aria-live={rotating ? 'off' : 'polite'} aria-busy={pending}>{pending ? 'Loading…' : <>{String(active + 1).padStart(2, '0')} <span>/ {String(photos.length).padStart(2, '0')}</span></>}</span>
        <button type="button" aria-label="Next community photo" onClick={() => change(1)} className={styles.iconButton}><ArrowRight size={17} aria-hidden="true" /></button>
        {!reducedMotion && <button type="button" aria-label={playing ? 'Pause photo rotation' : 'Play photo rotation'} aria-pressed={playing}
          onClick={() => setPlaying(value => !value)} className={`${styles.iconButton} ${styles.playButton}`}>
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        </button>}
      </div>
    </div>
  );
}
