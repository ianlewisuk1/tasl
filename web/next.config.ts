import path from "node:path";

import type { NextConfig } from "next";

// Division addresses from before the men's divisions took English pyramid names.
const RENAMED_DIVISIONS: Record<string, string> = {
  "triangle-mens-premier-league": "premier-league",
  "mens-1": "premier-league",
  "mens-2": "championship",
  "mens-3": "league-one",
  "mens-4": "league-two",
  "mens-5": "national-league",
};

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // A package-lock.json in a parent directory confuses workspace detection.
  turbopack: { root: path.resolve(__dirname) },
  async redirects() {
    return Object.entries(RENAMED_DIVISIONS).map(([from, to]) => ({
      source: `/:season/${from}`,
      destination: `/:season/${to}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
