import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // ESLintエラーがあってもビルドを続行
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TypeScriptエラーがあってもビルドを続行
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
