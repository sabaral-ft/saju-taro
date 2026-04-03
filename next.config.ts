import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/saju-taro',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
