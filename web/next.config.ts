import path from "node:path";

import type { NextConfig } from "next";

// Division addresses from before the men's and co-ed divisions took English pyramid names.
const RENAMED_DIVISIONS: Record<string, string> = {
  "triangle-mens-premier-league": "premier-league",
  "mens-1": "premier-league",
  "mens-2": "championship",
  "mens-3": "league-one",
  "mens-4": "league-two",
  "mens-5": "national-league",
  "coed-premier-championship": "co-ed-premier-league",
  "coed-select": "co-ed-championship",
  "coed-championship": "co-ed-championship",
  "coed-cup": "co-ed-league-one",
  "coed-eight-1": "co-ed-league-two",
  "coed-eight-2": "co-ed-national-league",
  "coed-eight-3": "co-ed-national-league-north",
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
