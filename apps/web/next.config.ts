import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @sarvam/tatva ships untranspiled ESM; Next has to compile it as app code.
  transpilePackages: ['@sarvam/tatva'],
  // Suppress the `X-Powered-By: Next.js` response header (fingerprinting).
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['@sarvam/tatva', '@hugeicons/react', '@hugeicons/core-free-icons'],
  },
};

export default nextConfig;
