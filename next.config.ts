import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "site-images.similarcdn.com",
      },
    ],
  },
};

export default nextConfig;
