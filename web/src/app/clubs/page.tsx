import type { Metadata } from "next";

import { ClubDirectory } from "@/components/ClubDirectory";
import { getClubs } from "@/lib/data";

export const metadata: Metadata = { title: "Clubs" };

const FAMILY_ORDER = ["mens", "coed", "womens", "mens-o30", "mens-o40", "mens-o50", "mens-o56", "mens-o60", "coed-o30"];

export default async function ClubsPage() {
  const clubs = await getClubs();
  const groups = [...new Set(clubs.map((c) => c.family))]
    .sort((a, b) => (FAMILY_ORDER.indexOf(a) + 1 || 99) - (FAMILY_ORDER.indexOf(b) + 1 || 99))
    .map((family) => ({
      family,
      label: clubs.find((c) => c.family === family)!.familyLabel,
      clubs: clubs.filter((c) => c.family === family).map((c) => ({
        slug: c.slug, name: c.name, teamId: c.teamId, colours: c.colours, titles: c.titles,
        seasons: new Set(c.seasons.map((s) => s.season)).size,
        latest: c.seasons[c.seasons.length - 1].divisionName,
      })),
    }));
  return (
    <>
      <div className="hero"><div className="wrap"><h1>Clubs</h1></div></div>
      <main className="wrap"><ClubDirectory groups={groups} total={clubs.length} /></main>
    </>
  );
}
