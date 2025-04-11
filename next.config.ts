import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // ESLintエラーがあってもビルドを続行
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
