// Legacy decorative 3D animated background, retired as part of the light
// professional redesign (see UI_REDESIGN_SPEC.md — no animated gradients or
// scroll-triggered decoration). Kept as a no-op with the same props so
// pages that still import it don't need any changes.
export default function PageBackground3D({ theme }: { theme?: string }) {
  return null;
}
