export const DESKTOP_STORE_PRODUCT_ID = '9NHV6GFJ64C8';

export interface PublishedDesktopStoreRelease {
  version: string;
  status: 'published';
  confirmedBy: 'partner-center';
  publishedAt: string;
  notes: readonly string[];
}

// HUMAN-MAINTAINED PUBLICATION RECORD. Keep this empty until an operator has
// confirmed the exact package version is Published in Microsoft Partner Center.
// A repository version, uploaded package, certification, or a GitHub tag is not
// publication evidence. Do not generate this catalog from package.json, CI,
// build artifacts, or the current submission. See BlueV2's publisher workflow.
export const publishedDesktopStoreReleases: readonly PublishedDesktopStoreRelease[] = Object.freeze([]);

function storeVersion(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 32
    || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))?$/.test(value)) return undefined;
  const parts = value.split('.').map(Number);
  if (parts.some(part => !Number.isSafeInteger(part) || part > 65535)) return undefined;
  if (parts.length === 3) parts.push(0);
  return parts.join('.');
}

function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 4; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function getDesktopStoreReleaseManifest(
  catalog: readonly unknown[] = publishedDesktopStoreReleases,
  now: number = Date.now()
) {
  const manifest = {
    schemaVersion: 1 as const,
    productId: DESKTOP_STORE_PRODUCT_ID,
    channel: 'microsoft-store' as const,
    releases: [] as PublishedDesktopStoreRelease[]
  };
  if (!Array.isArray(catalog) || catalog.length > 32) return manifest;
  const versions = new Set<string>();
  for (const item of catalog) {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    if (row.status !== 'published') continue;
    const version = storeVersion(row.version);
    const publishedAt = typeof row.publishedAt === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(row.publishedAt)
      ? Date.parse(row.publishedAt) : NaN;
    // Fail closed for an invalid/ambiguous publication record. Never turn an
    // upcoming version into a release announcement by trying to repair it.
    if (!version || row.confirmedBy !== 'partner-center' || !Number.isFinite(publishedAt)
      || publishedAt <= 0 || publishedAt > now || versions.has(version)
      || !Array.isArray(row.notes) || row.notes.length > 10
      || row.notes.some(note => typeof note !== 'string' || !note.trim() || note.length > 500
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note))) {
      manifest.releases = [];
      return manifest;
    }
    versions.add(version);
    manifest.releases.push({ version, status: 'published', confirmedBy: 'partner-center',
      publishedAt: new Date(publishedAt).toISOString(), notes: row.notes.map(note => (note as string).trim()) });
  }
  manifest.releases.sort((a, b) => compareVersions(b.version, a.version));
  // The Desktop client caps anonymous metadata downloads at 64 KiB.
  if (Buffer.byteLength(JSON.stringify(manifest), 'utf8') > 64 * 1024) manifest.releases = [];
  return manifest;
}
