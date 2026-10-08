import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emits .next/standalone: a self-contained server with only the modules the
  // app actually imports, which keeps the production image small.
  output: 'standalone',
  // Loaded from node_modules at runtime rather than bundled; the standalone
  // trace copies it into the image.
  serverExternalPackages: ['@azure/storage-blob'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**.blob.core.windows.net' }],
  },
  experimental: {
    optimizePackageImports: ['motion'],
    // Photos and payment screenshots are uploaded through server actions,
    // whose default limit is 1 MB: most phone photos are larger. 9 MB leaves
    // room for the form fields around the 8 MB the image pipeline accepts
    // (MAX_UPLOAD_BYTES in server/services/media.ts), which is checked again
    // on the server.
    serverActions: { bodySizeLimit: '9mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default config;
