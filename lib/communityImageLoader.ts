// A small, shared queue for nearby photo preloads. Normal page images retain
// native browser lazy loading; we do not eagerly fetch entire event albums.
export class CommunityImageLoader {
  private active = 0;
  private queue: { src: string; resolve: () => void; reject: (error: unknown) => void }[] = [];
  private pending = new Map<string, Promise<void>>();
  private ready = new Map<string, string>();

  constructor(private load: (src: string) => Promise<void>, private concurrency = 2) {}

  source(src: string) { return this.ready.get(src) || src; }

  remember(src: string, loadedSource = src) {
    this.ready.delete(src);
    this.ready.set(src, loadedSource);
    // Bound the cache when more community events are added in the future.
    if (this.ready.size > 80) this.ready.delete(this.ready.keys().next().value!);
  }

  forget(src: string) { this.ready.delete(src); }

  preload(src: string): Promise<void> {
    if (this.ready.has(src)) return Promise.resolve();
    const existing = this.pending.get(src);
    if (existing) return existing;
    const promise = new Promise<void>((resolve, reject) => { this.queue.push({ src, resolve, reject }); });
    this.pending.set(src, promise);
    this.drain();
    return promise;
  }

  private drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift()!;
      if (this.ready.has(job.src)) {
        this.pending.delete(job.src);
        job.resolve();
        continue;
      }
      this.active++;
      const finish = (error?: unknown) => {
        this.active--;
        this.pending.delete(job.src);
        if (error) job.reject(error);
        else { this.remember(job.src); job.resolve(); }
        this.drain();
      };
      Promise.resolve().then(() => this.load(job.src)).then(() => finish(), error => finish(error));
    }
  }
}

function loadBrowserImage(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.onLine) { reject(new Error('Image preload unavailable')); return; }
    const image = new window.Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (error) { image.src = ''; reject(error); } else resolve();
    };
    // Release a stalled preload slot so one slow request cannot hold the queue.
    const timer = window.setTimeout(() => finish(new Error('Image preload stalled')), 12000);
    image.decoding = 'async';
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().then(() => finish(), () => image.naturalWidth ? finish() : finish(new Error('Image decoding failed')));
      else finish();
    };
    image.onerror = () => finish(new Error('Image preload failed'));
    image.src = src;
  });
}

export const communityImageLoader = new CommunityImageLoader(loadBrowserImage);

export function preloadNearbyPhotos(sources: string[]) {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  Array.from(new Set(sources)).forEach(source => { void communityImageLoader.preload(source).catch(() => {}); });
}
