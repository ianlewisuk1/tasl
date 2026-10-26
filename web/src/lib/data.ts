import { readFile } from "node:fs/promises";
import { cache } from "react";
import path from "node:path";

import { withGameweeks } from "./table";
import type { DivisionView, Index, SeasonData } from "./types";

// Written by `python -m tasl_scraper export`; committed so the site builds without the scraper.
const DATA_DIR = path.join(process.cwd(), "data");

export const getIndex = cache(async (): Promise<Index> => {
  return JSON.parse(await readFile(path.join(DATA_DIR, "index.json"), "utf8"));
});

export const getSeason = cache(async (slug: string): Promise<SeasonData | null> => {
  const index = await getIndex();
  if (!index.seasons.some((s) => s.slug === slug)) return null;
  return JSON.parse(await readFile(path.join(DATA_DIR, "seasons", `${slug}.json`), "utf8"));
});

/** Flagship division to land on when none is chosen. */
export const DEFAULT_DIVISION = "mens-premier-league";

export async function getDivisionView(seasonSlug: string, divisionSlug: string): Promise<DivisionView | null> {
  const [index, data] = await Promise.all([getIndex(), getSeason(seasonSlug)]);
  const division = data?.divisions.find((d) => d.slug === divisionSlug);
  if (!data || !division) return null;
  const ids = new Set(division.pools.flatMap((p) => p.teamIds));
  const own = data.matches.filter((m) => ids.has(m.home ?? -1) || ids.has(m.away ?? -1));
  const { matches, gameweeks } = withGameweeks(own);
  const opponents = new Set(own.flatMap((m) => [m.home, m.away]));
  return {
    season: data.season,
    division,
    teams: data.teams.filter((t) => ids.has(t.id) || opponents.has(t.id)),
    matches,
    gameweeks,
    seasons: index.seasons.map((s) => ({
      slug: s.slug,
      name: s.name,
      hasDivision: s.divisions.some((d) => d.slug === divisionSlug),
    })),
    divisions: data.divisions.map((d) => ({ slug: d.slug, name: d.name })),
    generatedAt: index.generatedAt,
  };
}
