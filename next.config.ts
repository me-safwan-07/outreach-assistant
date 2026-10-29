import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Prevent Next.js from bundling server-only libs into client bundles
  experimental: {},
};

export default nextConfig;
