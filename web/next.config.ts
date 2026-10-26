import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // A package-lock.json in a parent directory confuses workspace detection.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
