"use client";

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ImageOff, RotateCw } from 'lucide-react';
import { communityImageLoader } from '@/lib/communityImageLoader';
import styles from './CommunityImage.module.css';

type Props = {
  src: string;
  thumbnail?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  retryable?: boolean;
  compact?: boolean;
};

// Key the inner state to the source: a late load event from the previous
// album photo must never mark the newly selected photograph as ready.
export default function CommunityImage(props: Props) { return <ManagedImage key={props.src} {...props} />; }

function ManagedImage({ src, thumbnail, alt, sizes, priority = false, retryable = true, compact = false }: Props) {
  const image = useRef<HTMLImageElement>(null);
  const frame = useRef<HTMLSpanElement>(null);
  const alive = useRef(true);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [enhanced, setEnhanced] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'fallback' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState(false);
  const [base, setBase] = useState(src);
  const [nearViewport, setNearViewport] = useState(priority);
  const requestSource = preview && thumbnail ? thumbnail : attempt || revision
    ? `${src}${src.includes('?') ? '&' : '?'}retry=${revision}-${attempt}` : base;

  useEffect(() => {
    alive.current = true;
    setEnhanced(true);
    setBase(communityImageLoader.source(src));
    return () => { alive.current = false; clearTimeout(retryTimer.current); };
  }, []);

  useEffect(() => {
    if (priority || typeof IntersectionObserver === 'undefined') { setNearViewport(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNearViewport(true); observer.disconnect(); }
    }, { rootMargin: '300px' });
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, [priority]);

  useEffect(() => {
    if (!enhanced || !nearViewport || state !== 'loading') return;
    const watchdog = window.setTimeout(() => {
      if (image.current?.complete && image.current.naturalWidth) void ready(image.current);
      else failed();
    }, 20000);
    return () => window.clearTimeout(watchdog);
    // Offscreen lazy images have no deadline until they approach the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestSource, state, enhanced, nearViewport]);

  useEffect(() => {
    // Hydration and a reused browser cache can finish before onLoad attaches.
    const current = image.current;
    if (current?.complete && current.naturalWidth > 0) ready(current);
    // requestSource is the identity of this individual request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestSource]);

  useEffect(() => {
    if (state !== 'error' && state !== 'fallback') return;
    const recover = () => retry();
    window.addEventListener('online', recover);
    return () => window.removeEventListener('online', recover);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function retry() {
    clearTimeout(retryTimer.current);
    communityImageLoader.forget(src);
    setRevision(Date.now());
    setAttempt(0);
    setPreview(false);
    setState('loading');
  }

  async function ready(element: HTMLImageElement) {
    const expected = element.src;
    try { await element.decode?.(); } catch { /* onLoad plus naturalWidth still confirms a renderable image. */ }
    if (!alive.current || element !== image.current || element.src !== expected || !element.naturalWidth) return;
    clearTimeout(retryTimer.current);
    if (!preview) communityImageLoader.remember(src, requestSource);
    setState(preview ? 'fallback' : 'ready');
  }

  function failed() {
    communityImageLoader.forget(src);
    clearTimeout(retryTimer.current);
    if (preview || !navigator.onLine) { setState('error'); return; }
    if (attempt < 2) {
      retryTimer.current = setTimeout(() => {
        if (!alive.current) return;
        setRevision(Date.now());
        setAttempt(value => value + 1);
        setState('loading');
      }, (attempt + 1) * 700);
    } else if (thumbnail && thumbnail !== src) { setPreview(true); setState('loading'); }
    else setState('error');
  }

  return (
    <span ref={frame} className={`${styles.frame} ${compact ? styles.compact : ''}`} data-image-state={state} data-enhanced={enhanced} aria-busy={enhanced && state === 'loading'}>
      <Image key={requestSource} ref={image} src={requestSource} alt={alt} fill unoptimized sizes={sizes}
        priority={priority} loading={priority ? 'eager' : 'lazy'} decoding="async"
        onLoad={event => void ready(event.currentTarget)} onError={failed} className={styles.image} />
      <span className={styles.skeleton} aria-hidden="true"><span className={styles.spinner} />{!compact && <span>Loading photo</span>}</span>
      {state === 'error' && <span className={styles.error}>
        <ImageOff size={compact ? 15 : 23} aria-hidden="true" />
        {!compact && <span>Photo couldn&apos;t load</span>}
        {retryable && <button type="button" onClick={retry} aria-label="Retry loading photo"><RotateCw size={13} aria-hidden="true" />Retry</button>}
      </span>}
      {state === 'fallback' && retryable && <button type="button" className={styles.retryFull} onClick={retry}><RotateCw size={12} aria-hidden="true" />Load full photo</button>}
    </span>
  );
}
