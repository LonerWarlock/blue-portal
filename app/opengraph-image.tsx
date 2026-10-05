import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Blue — AI coding assistant made specifically for students';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: '#f5f7ff', color: '#111b31', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}><span style={{ fontSize: 44, fontWeight: 700, color: '#195bff' }}>Blue</span><span style={{ fontSize: 22, color: '#53627d' }}>by Imergene</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}><span style={{ fontSize: 66, fontWeight: 700, letterSpacing: -3 }}>Your ideas. Blue&apos;s craft.</span><span style={{ fontSize: 38, color: '#195bff' }}>AI coding assistant made for students.</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cdd5e8', paddingTop: 24, fontSize: 24, color: '#53627d' }}><span>Windows Desktop + VS Code</span><span>Learn by building.</span></div>
    </div>, size,
  );
}
