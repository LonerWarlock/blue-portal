"use client";

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Images, MapPin, Maximize2, X } from 'lucide-react';
import type { CommunityEvent } from '@/lib/community';
import styles from './community.module.css';

export default function EventAlbum({ event }: { event: CommunityEvent }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const photo = event.photos[selected];

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => () => { dialog.current?.close(); }, []);

  function showPhoto(index: number) {
    setSelected(index);
    dialog.current?.showModal();
    setOpen(true);
  }

  function close() { dialog.current?.close(); }
  function change(delta: number) { setSelected(index => (index + delta + event.photos.length) % event.photos.length); }

  return (
    <article id={event.id} className={styles.eventCard}>
      <button type="button" className={styles.eventCover} onClick={() => showPhoto(event.photos.findIndex(item => item.id === event.cover.id))}
        aria-label={`Open ${event.title} photo album`} aria-haspopup="dialog">
        <Image src={event.cover.src} alt={event.cover.alt} fill unoptimized sizes="(max-width: 700px) 90vw, 50vw" />
        <span className={styles.coverTag}>{event.category}</span>
        <span className={styles.expandPhoto}><Maximize2 size={17} aria-hidden="true" /></span>
      </button>
      <div className={styles.eventBody}>
        <div className={styles.eventMeta}><span>Chapter {event.number}</span><span>Past event</span></div>
        <h3>{event.title}</h3>
        <p className={styles.location}><MapPin size={14} aria-hidden="true" />{event.location}</p>
        <p className={styles.eventDescription}>{event.description}</p>
        <div className={styles.albumStrip} aria-label={`${event.title} photo previews`}>
          {event.photos.slice(0, 4).map((item, index) => <button key={item.id} type="button" onClick={() => showPhoto(index)}
            aria-label={`View photo ${index + 1} from ${event.title}`} aria-haspopup="dialog">
            <Image src={item.thumbnail} alt="" fill unoptimized sizes="120px" />
            {index === 3 && <span>+{event.photos.length - 3}</span>}
          </button>)}
        </div>
        <button type="button" className={styles.albumLink} onClick={() => showPhoto(0)} aria-haspopup="dialog">
          <Images size={17} aria-hidden="true" /> View all {event.photos.length} photos <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>

      <dialog ref={dialog} className={styles.photoDialog} aria-labelledby={`${event.id}-album-title`}
        onClose={() => setOpen(false)}
        onClick={e => { if (e.target === e.currentTarget) close(); }}
        onKeyDown={e => {
          if (e.key === 'ArrowRight') { e.preventDefault(); change(1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); change(-1); }
        }}>
        {open && <div className={styles.dialogContent}>
          <div className={styles.dialogHeader}>
            <div><p className={styles.label}>Community album</p><h3 id={`${event.id}-album-title`}>{event.title}</h3></div>
            <button type="button" onClick={close} className={styles.iconButton} aria-label="Close photo album" autoFocus><X size={20} aria-hidden="true" /></button>
          </div>
          <div className={styles.dialogImage}>
            <Image key={photo.id} src={photo.src} alt={photo.alt} fill unoptimized sizes="90vw" />
          </div>
          <div className={styles.dialogNavigation}>
            <button type="button" className={styles.iconButton} onClick={() => change(-1)} aria-label="Previous album photo"><ArrowLeft size={18} aria-hidden="true" /></button>
            <p aria-live="polite">{selected + 1} <span>/ {event.photos.length}</span></p>
            <button type="button" className={styles.iconButton} onClick={() => change(1)} aria-label="Next album photo"><ArrowRight size={18} aria-hidden="true" /></button>
          </div>
          <p className={styles.dialogCaption}>{photo.alt}</p>
          <div className={styles.dialogThumbnails} aria-label="Choose an album photo">
            {event.photos.map((item, index) => <button key={item.id} type="button" onClick={() => setSelected(index)}
              aria-label={`Show album photo ${index + 1}`} aria-pressed={selected === index}>
              <Image src={item.thumbnail} alt="" fill unoptimized sizes="72px" />
            </button>)}
          </div>
        </div>}
      </dialog>
    </article>
  );
}
