import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeagueView } from "@/components/LeagueView";
import { getDivisionView, getIndex } from "@/lib/data";

export async function generateStaticParams() {
  const index = await getIndex();
  return index.seasons.flatMap((s) => s.divisions.map((d) => ({ season: s.slug, division: d.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[season]/[division]">): Promise<Metadata> {
  const { season, division } = await params;
  const view = await getDivisionView(season, division);
  return { title: view ? `${view.division.name} table, ${view.season.name}` : "Not found" };
}

export default async function DivisionPage({ params }: PageProps<"/[season]/[division]">) {
  const { season, division } = await params;
  const view = await getDivisionView(season, division);
  if (!view) notFound();
  return <LeagueView view={view} />;
}
