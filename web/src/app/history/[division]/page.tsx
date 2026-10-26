import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Crest } from "@/lib/crest";
import { getClubs, getHistories, getIndex } from "@/lib/data";
import type { Team } from "@/lib/types";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getHistories()).map((h) => ({ division: h.slug }));
}

export async function generateMetadata({ params }: PageProps<"/history/[division]">): Promise<Metadata> {
  const { division } = await params;
  const h = (await getHistories()).find((x) => x.slug === division);
  return { title: h ? `${h.name} history` : "Not found" };
}

const TOP = 20;

export default async function HistoryPage({ params }: PageProps<"/history/[division]">) {
  const { division } = await params;
  const h = (await getHistories()).find((x) => x.slug === division);
  if (!h) notFound();
  const clubs = new Map((await getClubs()).map((c) => [c.slug, c]));
  const crest = (slug: string, name: string): Team => {
    const c = clubs.get(slug);
    return { id: c?.teamId ?? 0, name, colours: c?.colours ?? null };
  };
  const index = await getIndex();
  const current = index.seasons.find((s) => s.isCurrent);
  const live = current?.divisions.some((d) => d.slug === h.slug);
  const allTimeRow = (r: (typeof h.allTime)[number], i: number) => (
    <tr key={r.club}>
      <td className="l">{i + 1}</td>
      <td className="l"><Link href={`/clubs/${r.club}`} className="mt"><Crest team={crest(r.club, r.name)} size={18} /><span>{r.name}</span></Link></td>
      <td className="hide-sm">{r.seasons}</td>
      <td>{r.titles || ""}</td>
      <td>{r.p}</td>
      <td className="hide-sm">{r.w}</td><td className="hide-sm">{r.d}</td><td className="hide-sm">{r.l}</td>
      <td className="hide-sm">{r.gf - r.ga}</td>
      <td className="b">{r.pts}</td>
    </tr>
  );
  const head = (
    <thead><tr>
      <th className="l">#</th><th className="l">Club</th><th className="hide-sm">Seasons</th><th title="Titles">🏆</th><th>Pl</th>
      <th className="hide-sm">W</th><th className="hide-sm">D</th><th className="hide-sm">L</th><th className="hide-sm">GD</th><th>Pts</th>
    </tr></thead>
  );

  return (
    <>
      <div className="hero"><div className="wrap"><h1>{h.name} history</h1></div></div>
      <main className="wrap clubpage">
        {live && current && <p className="notes"><Link href={`/tables/${current.slug}/${h.slug}`} className="more">Current table</Link></p>}
        <section>
          <div className="sectionhead"><h2>Honours</h2><span>{h.seasons.length} seasons</span></div>
          <div className="honours">
            {h.seasons.map((s) => s.winners.map((w) => (
              <div key={`${s.season}-${w.pool}`} className="honour">
                <span className="hseason">{s.seasonName}{w.pool && <small> · {w.pool}</small>}</span>
                <Link href={`/clubs/${w.champion.club}`} className="hchamp">
                  <Crest team={crest(w.champion.club, w.champion.name)} size={26} />
                  <span><b>{w.champion.name}</b><small>Champions · {w.champion.pts} pts</small></span>
                </Link>
                {w.runnerUp && (
                  <Link href={`/clubs/${w.runnerUp.club}`} className="hrun">
                    <Crest team={crest(w.runnerUp.club, w.runnerUp.name)} size={20} />
                    <span>{w.runnerUp.name}<small>Runners-up · {w.runnerUp.pts} pts</small></span>
                  </Link>
                )}
              </div>
            )))}
          </div>
        </section>
        <section>
          <div className="sectionhead"><h2>All-time table</h2><span>Every season in this division</span></div>
          <div className="tablebox"><table className="hist">{head}<tbody>{h.allTime.slice(0, TOP).map(allTimeRow)}</tbody></table></div>
          {h.allTime.length > TOP && (
            <details className="more-rows">
              <summary>{h.allTime.length - TOP} more clubs</summary>
              <div className="tablebox"><table className="hist"><tbody>{h.allTime.slice(TOP).map((r, i) => allTimeRow(r, i + TOP))}</tbody></table></div>
            </details>
          )}
        </section>
        <div className="notes foot"><span>Champion is first place in the regular-season table, using the TASL tiebreakers. Summer Heat is not included.</span></div>
      </main>
    </>
  );
}
