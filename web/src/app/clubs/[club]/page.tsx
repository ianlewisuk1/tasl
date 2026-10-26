import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Crest } from "@/lib/crest";
import { getClubs, getIndex } from "@/lib/data";
import type { Club, ClubSeason } from "@/lib/types";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getClubs()).map((c) => ({ club: c.slug }));
}

async function findClub(slug: string) {
  return (await getClubs()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/clubs/[club]">): Promise<Metadata> {
  const club = await findClub((await params).club);
  return { title: club ? `${club.name}: club history` : "Not found" };
}

function ordinal(n: number) {
  const suffix = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}
/** "Spring 2026" -> "Spr 26", "Fall 2025" -> "Fall 25". */
const shortSeason = (name: string) => name.replace(/^Spring /, "Spr ").replace(/ 20(\d{2})$/, " $1");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

/** Tier change versus the club's previous season in the same pyramid. */
function movement(prev: ClubSeason | undefined, cur: ClubSeason): "up" | "down" | null {
  if (!prev || prev.tier === null || cur.tier === null || prev.tier === cur.tier) return null;
  return cur.tier < prev.tier ? "up" : "down";
}

export default async function ClubPage({ params }: PageProps<"/clubs/[club]">) {
  const club = await findClub((await params).club);
  if (!club) notFound();
  const index = await getIndex();
  const live = new Set(index.seasons.map((s) => s.slug));
  const t = club.totals;
  const crestTeam = { id: club.teamId, name: club.name, colours: club.colours };
  const newestFirst = [...club.seasons].reverse();
  const h2hTop = club.headToHead.slice(0, 12), h2hRest = club.headToHead.slice(12);

  return (
    <>
      <div className="hero clubhero">
        <div className="wrap">
          <Crest team={crestTeam} size={84} />
          <div>
            <span className="kicker">{club.familyLabel}</span>
            <h1>{club.name}</h1>
            {club.otherNames.length > 0 && <p className="aka">Also played as {club.otherNames.join(", ")}</p>}
          </div>
        </div>
      </div>

      <main className="wrap clubpage">
        <section className="clubstats" aria-label="All-time record">
          {[
            ["Seasons", String(new Set(club.seasons.map((s) => s.season)).size)],
            ["Titles", String(club.titles)],
            ["Played", String(t.p)],
            ["Won", String(t.w)],
            ["Drawn", String(t.d)],
            ["Lost", String(t.l)],
            ["Win rate", pct(t.w, t.p)],
            ["Goals", `${t.gf}–${t.ga}`],
          ].map(([label, value]) => (
            <div key={label} className="cstat"><b>{value}</b><span>{label}</span></div>
          ))}
        </section>

        <Journey club={club} />

        <section>
          <div className="sectionhead"><h2>Season by season</h2></div>
          <div className="tablebox">
            <table className="hist">
              <thead>
                <tr>
                  <th className="l">Season</th><th className="l">Division</th><th>Finish</th>
                  <th>Pl</th><th className="hide-sm">W</th><th className="hide-sm">D</th><th className="hide-sm">L</th>
                  <th className="hide-sm">GD</th><th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((s, i) => {
                  const prev = newestFirst[i + 1];
                  const move = movement(prev, s);
                  const relegated = s.of >= 6 && s.pos > s.of - 2 && s.p > 0;
                  return (
                    <tr key={`${s.season}-${s.teamId}`} className={s.champion ? "champ" : relegated ? "releg" : undefined}>
                      <td className="l">{s.seasonName}</td>
                      <td className="l">
                        {live.has(s.season)
                          ? <Link href={`/tables/${s.season}/${s.division}`}>{s.divisionName}</Link>
                          : s.divisionName}
                        {s.pool && <span className="poolname"> · {s.pool}</span>}
                        {move && <span className={`move ${move}`}>{move === "up" ? "Promoted" : "Relegated"}</span>}
                      </td>
                      <td className="fin">{s.p ? <>{ordinal(s.pos)}<small> of {s.of}</small></> : "–"}{s.champion && " 🏆"}</td>
                      <td>{s.p}</td>
                      <td className="hide-sm">{s.w}</td><td className="hide-sm">{s.d}</td><td className="hide-sm">{s.l}</td>
                      <td className="hide-sm">{s.gf - s.ga}</td>
                      <td className="b">{s.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {club.headToHead.length > 0 && (
          <section>
            <div className="sectionhead"><h2>Head to head</h2><span>All seasons, regular-season games</span></div>
            <div className="tablebox">
              <table className="hist">
                <thead><tr><th className="l">Opponent</th><th>Pl</th><th>W</th><th>D</th><th>L</th><th className="hide-sm">GF</th><th className="hide-sm">GA</th></tr></thead>
                <tbody>
                  {h2hTop.map((o) => <H2HRow key={o.club} o={o} />)}
                </tbody>
              </table>
            </div>
            {h2hRest.length > 0 && (
              <details className="more-rows">
                <summary>{h2hRest.length} more opponents</summary>
                <div className="tablebox">
                  <table className="hist"><tbody>{h2hRest.map((o) => <H2HRow key={o.club} o={o} />)}</tbody></table>
                </div>
              </details>
            )}
          </section>
        )}
        <div className="notes foot"><span>Club history links each season&apos;s TeamPass team by name. Summer Heat is not included.</span></div>
      </main>
    </>
  );
}

function H2HRow({ o }: { o: Club["headToHead"][number] }) {
  return (
    <tr>
      <td className="l"><Link href={`/clubs/${o.club}`}>{o.name}</Link></td>
      <td>{o.p}</td><td>{o.w}</td><td>{o.d}</td><td>{o.l}</td>
      <td className="hide-sm">{o.gf}</td><td className="hide-sm">{o.ga}</td>
    </tr>
  );
}

/** Where the club sat in its pyramid each season: one dot per season, higher tiers at the top. */
function Journey({ club }: { club: Club }) {
  const pts = club.seasons.filter((s) => s.tier !== null);
  if (new Set(pts.map((s) => s.season)).size < 2) return null;
  const tiers = [...new Set(pts.map((s) => s.tier!))].sort((a, b) => a - b);
  const names = new Map(pts.map((s) => [s.tier!, s.divisionName]));
  const seasons = [...new Set(club.seasons.map((s) => s.season))];
  const W = 720, rowH = 34, L = 170, R = 20, T = 14, B = 28, H = T + B + rowH * Math.max(tiers.length - 1, 1);
  const x = (i: number) => L + (seasons.length === 1 ? 0 : (i * (W - L - R)) / (seasons.length - 1));
  const y = (tier: number) => T + tiers.indexOf(tier) * rowH;
  const points = pts.map((s) => ({ s, cx: x(seasons.indexOf(s.season)), cy: y(s.tier!) }));
  return (
    <section>
      <div className="sectionhead"><h2>Pyramid journey</h2></div>
      <div className="tablebox">
        <svg className="journey" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${club.name}'s division each season`}>
          {tiers.map((tier) => (
            <g key={tier}>
              <line x1={L - 10} x2={W - R} y1={y(tier)} y2={y(tier)} className="grid" />
              <text x={L - 16} y={y(tier) + 4} textAnchor="end" className="ax">{names.get(tier)}</text>
            </g>
          ))}
          {seasons.map((s, i) => (
            <text key={s} x={x(i)} y={H - 8} textAnchor="middle" className="ax">
              {shortSeason(club.seasons.find((c) => c.season === s)!.seasonName)}
            </text>
          ))}
          <path className="ln" d={points.map((p, i) => `${i ? "L" : "M"}${p.cx} ${p.cy}`).join("")} />
          {points.map((p) => (
            <circle key={`${p.s.season}-${p.s.teamId}`} cx={p.cx} cy={p.cy} r={p.s.champion ? 7 : 5} className={p.s.champion ? "dot champ" : "dot"}>
              <title>{`${p.s.seasonName}: ${ordinal(p.s.pos)} in ${p.s.divisionName}`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </section>
  );
}
