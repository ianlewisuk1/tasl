import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeagueView, type Section } from "@/components/LeagueView";
import { getDivisionView, getIndex } from "./data";

type Params = Promise<{ season: string; division: string }>;
const TITLE: Record<Section, string> = { tables: "table", results: "results", fixtures: "fixtures" };

/** Shared implementation of /tables, /results and /fixtures for each season and division. */
export function sectionPage(section: Section) {
  async function generateStaticParams() {
    const index = await getIndex();
    return index.seasons.flatMap((s) => s.divisions.map((d) => ({ season: s.slug, division: d.slug })));
  }

  async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { season, division } = await params;
    const view = await getDivisionView(season, division);
    return { title: view ? `${view.division.name} ${TITLE[section]}, ${view.season.name}` : "Not found" };
  }

  async function Page({ params }: { params: Params }) {
    const { season, division } = await params;
    const view = await getDivisionView(season, division);
    if (!view) notFound();
    return <LeagueView view={view} section={section} />;
  }

  return { generateStaticParams, generateMetadata, Page };
}
