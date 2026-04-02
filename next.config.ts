import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/saju-taro',
  images: { unoptimized: true },
};

export default nextConfig;
