/** @type {import('next').NextConfig} */
const nextConfig = {
  // 実験的機能
  experimental: {
    // Server Actions有効化
    serverActions: {
      bodySizeLimit: '2mb',
    },
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

  // 出力設定（スタンドアロンビルド用）
  output: 'standalone',

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

  // ヘッダー設定
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
