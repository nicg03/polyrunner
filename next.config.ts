import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Watch photos submitted as race results (capped at 5 MB in the action).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
