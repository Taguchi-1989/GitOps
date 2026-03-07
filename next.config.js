/** @type {import('next').NextConfig} */
const nextConfig = {
  // 実験的機能
  experimental: {
    // Server Actions有効化
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // pino/pino-prettyのworkerスレッドをWebpackバンドルから除外
    serverComponentsExternalPackages: ['pino', 'pino-pretty'],
  },

  // 画像最適化の設定
  images: {
    domains: [],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // WebpackカスタマイズA（Mermaid対応）
  webpack: (config, { isServer }) => {
    // Mermaid用のフォールバック
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },

  // 厳格モード
  reactStrictMode: true,

  // リダイレクト設定
  async redirects() {
    return [
      // 例：古いURLからのリダイレクト
      // {
      //   source: '/old-path',
      //   destination: '/new-path',
      //   permanent: true,
      // },
    ];
  },

  // セキュリティヘッダー（CORSはmiddleware.tsで制御）
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

module.exports = nextConfig;
