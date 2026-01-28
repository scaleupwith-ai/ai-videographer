import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Increase body size limit for video uploads (500MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
};

export default nextConfig;
