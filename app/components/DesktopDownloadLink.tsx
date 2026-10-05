"use client";

import { useEffect, useState, type ComponentPropsWithoutRef, type MouseEvent } from "react";
import { BLUE_DESKTOP_STORE_URL, getBlueDesktopLink, type DesktopLinkVariant } from "@/lib/desktop-download";

type Props = Omit<ComponentPropsWithoutRef<"a">, "href" | "target" | "rel" | "download"> & {
  variant?: DesktopLinkVariant;
};

export default function DesktopDownloadLink({ variant = "download", onClick, title, ...props }: Props) {
  const [href, setHref] = useState(BLUE_DESKTOP_STORE_URL);

  useEffect(() => {
    setHref(getBlueDesktopLink(variant, navigator, window.location.hostname));
  }, [variant]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const destination = getBlueDesktopLink(variant, navigator, window.location.hostname);
    // A click before the effect runs must still use the direct link, in that
    // same user gesture. Keep normal anchor navigation and keyboard behavior.
    event.currentTarget.href = destination;
    event.currentTarget.target = destination === BLUE_DESKTOP_STORE_URL ? "_blank" : "_self";
    event.currentTarget.rel = destination === BLUE_DESKTOP_STORE_URL ? "noopener noreferrer" : "";
  }

  const isWebListing = href === BLUE_DESKTOP_STORE_URL;
  return (
    <a
      {...props}
      href={href}
      target={isWebListing ? "_blank" : undefined}
      rel={isWebListing ? "noopener noreferrer" : undefined}
      title={title ?? (variant === "download" ? "Download the Microsoft-signed installer for Windows" : "Open Blue in Microsoft Store")}
      data-blue-desktop-link={variant}
      onClick={handleClick}
    />
  );
}
