"use client";

import { useEffect, useRef, useState } from "react";

interface LazyVideoProps {
  src: string;
  className?: string;
  type?: string;
  label: string;
  objectFit?: "contain" | "cover";
}

/**
 * Keeps large demo media off the network until it is close to the viewport.
 * Once loaded, playback pauses while the video is off-screen to reduce CPU and
 * battery use on long landing pages.
 */
export default function LazyVideo({
  src,
  className = "",
  type = "video/mp4",
  label,
  objectFit = "contain",
}: LazyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { rootMargin: "240px 0px", threshold: 0.05 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad || !videoRef.current) return;
    videoRef.current.load();
  }, [shouldLoad]);

  return (
    <video
      ref={videoRef}
      className={`${className} ${objectFit === "cover" ? "object-cover" : "object-contain"}`}
      aria-label={label}
      controls
      controlsList="nodownload"
      onContextMenu={event => event.preventDefault()}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
    >
      {shouldLoad ? <source src={src} type={type} /> : null}
      Your browser does not support the video tag.
    </video>
  );
}
