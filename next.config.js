const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');
const { publicMarketingRedirects } = require('./lib/seoRedirects.cjs');
const { ChunkLoadRecoveryPlugin } = require('./lib/chunk-recovery.cjs');

/** @type {import('next').NextConfig} */
module.exports = phase => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  poweredByHeader: false,
  webpack(config, { dev, isServer }) {
    if (!dev && !isServer) config.plugins.push(new ChunkLoadRecoveryPlugin());
    return config;
  },
  async redirects() {
    return publicMarketingRedirects();
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), payment=(self)'
        }
      ]
    }, ...['/api/:path*', '/console/:path*', '/checkout/:path*', '/blue-pro/checkout/:path*', '/blue-pro/dashboard/:path*'].map(source => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
    }))];
  }
});
