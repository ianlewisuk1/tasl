import path from "node:path";

import type { NextConfig } from "next";

// Division addresses from before the men's and co-ed divisions took English pyramid names.
const RENAMED_DIVISIONS: Record<string, string> = {
  // TeamPass names
  "triangle-mens-premier-league": "mens-premier-league",
  "mens-1": "mens-premier-league",
  "mens-2": "mens-championship",
  "mens-3": "mens-league-one",
  "mens-4": "mens-league-two",
  "mens-5": "mens-national-league",
  "coed-premier-championship": "coed-premier-league",
  "coed-select": "coed-championship",
  "coed-cup": "coed-league-one",
  "coed-eight-1": "coed-league-two",
  "coed-eight-2": "coed-national-league",
  "coed-eight-3": "coed-national-league-north",
  "men-over-30-1": "mens-over-30-premier-league",
  "men-over-30-2": "mens-over-30-championship",
  "men-over-30-3": "mens-over-30-league-one",
  "men-over-40": "mens-over-40-premier-league",
  "men-over-50": "mens-over-50-premier-league",
  "men-over-56": "mens-over-56-premier-league",
  "men-over-60": "mens-over-60-premier-league",
  "men-over-60-pickup": "mens-over-60-pickup",
  "coed-over-30-1-2": "coed-over-30-premier-league",
  "coed-over-30-3": "coed-over-30-championship",
  "coed-over-30-3b": "coed-over-30-championship",
  "coed-rec": "coed-recreational-league",
  "womens-premier": "womens-super-league",
  "womens-8v8-recreation": "womens-championship",
  // Earlier pyramid names used during development
  "premier-league": "mens-premier-league",
  "championship": "mens-championship",
  "league-one": "mens-league-one",
  "league-two": "mens-league-two",
  "national-league": "mens-national-league",
  "co-ed-premier-league": "coed-premier-league",
  "co-ed-championship": "coed-championship",
  "co-ed-league-one": "coed-league-one",
  "co-ed-league-two": "coed-league-two",
  "co-ed-national-league": "coed-national-league",
  "co-ed-national-league-north": "coed-national-league-north",
};

const nextConfig: NextConfig = {
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
