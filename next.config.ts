import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [new URL("https://cdn.nba.com/headshots/nba/latest/260x190/*.png")],
  },
};

export default nextConfig;