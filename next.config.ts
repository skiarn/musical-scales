import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  basePath: '/musical-scales',
  env: {
    basePath: '/musical-scales',
  },
};

export default nextConfig;
