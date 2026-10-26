import { redirect } from "next/navigation";

import { DEFAULT_DIVISION, getIndex } from "@/lib/data";

export default async function Home() {
  const index = await getIndex();
  const season = index.seasons.find((s) => s.isCurrent) ?? index.seasons[0];
  const division = season.divisions.find((d) => d.slug === DEFAULT_DIVISION) ?? season.divisions[0];
  redirect(`/${season.slug}/${division.slug}`);
}
