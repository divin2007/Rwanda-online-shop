import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  turbopack: {
    root: resolve(__dirname, '../..'),
  },
  images: {
    // Enable automatic image optimization
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.googleapis.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.imgur.com' },
      { protocol: 'https', hostname: '**.onrender.com' },
      { protocol: 'http', hostname: 'localhost', port: '3002' },
      { protocol: 'http', hostname: 'localhost', port: '3003' },
      { protocol: 'http', hostname: 'localhost', port: '3004' },
      { protocol: 'http', hostname: 'localhost', port: '3005' },
      { protocol: 'http', hostname: 'localhost', port: '3006' },
      { protocol: 'http', hostname: 'localhost', port: '3008' },
      { protocol: 'http', hostname: '127.0.0.1', port: '3002' },
      { protocol: 'http', hostname: '127.0.0.1', port: '3003' },
      { protocol: 'http', hostname: '127.0.0.1', port: '3004' },
      { protocol: 'http', hostname: '127.0.0.1', port: '3005' },
      { protocol: 'http', hostname: '127.0.0.1', port: '3006' },
      { protocol: 'http', hostname: '127.0.0.1', port: '3008' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        // Cache static assets aggressively
        source: '/(.*)\\.(png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
