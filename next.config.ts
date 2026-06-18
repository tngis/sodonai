import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      // R2 presigned URLs (private uploads/outputs). `**` because the SDK
      // presigns virtual-hosted style: <bucket>.<account>.r2.cloudflarestorage.com
      // — two labels, which a single `*` (one subdomain) would not match.
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      // R2 public bucket (examples) via r2.dev; add the custom CDN host here later.
      { protocol: "https", hostname: "pub-*.r2.dev" },
    ],
  },
};

export default nextConfig;
