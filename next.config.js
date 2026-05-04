/** @type {import('next').NextConfig} */
const nextPackage = require('next/package.json');
const nextMajor = Number.parseInt(nextPackage.version.split('.')[0], 10);

const sharedConfig = {
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },

  reactStrictMode: true,

  async redirects() {
    return [];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

const nextConfig =
  nextMajor >= 16
    ? {
        ...sharedConfig,
        serverActions: {
          bodySizeLimit: '2mb',
        },
        serverExternalPackages: ['pino', 'pino-pretty'],
      }
    : {
        ...sharedConfig,
        experimental: {
          serverActions: {
            bodySizeLimit: '2mb',
          },
          serverComponentsExternalPackages: ['pino', 'pino-pretty'],
        },
      };

module.exports = nextConfig;
