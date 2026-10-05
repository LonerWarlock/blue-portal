export const BLUE_DESKTOP_STORE_ID = '9NHV6GFJ64C8';
export const BLUE_DESKTOP_STORE_URL = `https://apps.microsoft.com/detail/${BLUE_DESKTOP_STORE_ID}`;
export const BLUE_DESKTOP_STORE_URI = `ms-windows-store://pdp/?ProductId=${BLUE_DESKTOP_STORE_ID}`;
export const BLUE_DESKTOP_INSTALLER_URL = `https://get.microsoft.com/installer/download/${BLUE_DESKTOP_STORE_ID}?referrer=appbadge`;

export type DesktopLinkVariant = 'download' | 'store';
export type DesktopBrowserPlatform = {
  userAgentData?: { platform?: string };
  userAgent?: string;
  platform?: string;
};

export function isWindowsDesktop(browser?: DesktopBrowserPlatform): boolean {
  const platformHint = browser?.userAgentData?.platform?.trim();
  if (platformHint) return platformHint.toLowerCase() === 'windows';
  // Do not send an EXE or Windows protocol to a mobile/non-Windows device.
  if (/Android|iPhone|iPad|iPod|Windows Phone/i.test(browser?.userAgent || '')) return false;
  return /Windows NT/i.test(browser?.userAgent || '') || /^Win(32|64)$/i.test(browser?.platform || '');
}

export function getBlueDesktopLink(
  variant: DesktopLinkVariant,
  browser?: DesktopBrowserPlatform,
  hostname?: string,
): string {
  // Server rendering and non-Windows visitors retain a usable public listing.
  if (!isWindowsDesktop(browser)) return BLUE_DESKTOP_STORE_URL;
  if (variant === 'store') return BLUE_DESKTOP_STORE_URI;
  // Same Microsoft-hosted endpoint as its official badge. No pinned app version.
  return hostname
    ? `${BLUE_DESKTOP_INSTALLER_URL}&source=${encodeURIComponent(hostname.toLowerCase())}`
    : BLUE_DESKTOP_INSTALLER_URL;
}
