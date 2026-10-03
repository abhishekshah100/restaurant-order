import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Hide the Next.js dev badge: it covers in-page controls (e.g. sheet steppers) while testing.
  devIndicators: false,
};

export default nextConfig;
