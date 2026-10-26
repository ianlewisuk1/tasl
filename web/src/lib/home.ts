import { getIndex, getSeason } from "./data";
import { type GwMatch, type Row, isPlayed, standings, withGameweeks } from "./table";
import type { Division, Team } from "./types";

/** The divisions shown as mini tables on the home page: the two main pyramids. */
const FEATURED = [
  "mens-premier-league", "mens-championship", "mens-league-one", "mens-league-two",
  "coed-premier-league", "coed-championship", "coed-league-one", "coed-league-two",
  "coed-national-league", "coed-national-league-north",
];
const LEAD_DIVISION = "mens-premier-league";

export type Result = GwMatch & { division: Division };
export type Story = { kicker: string; title: string; body: string; href: string; teams: Team[] };
export type MiniTable = { division: Division; href: string; rows: (Row & { team: Team })[] };

export type HomeData = {
  seasonName: string;
  seasonSlug: string;
  generatedAt: string;
  gameweek: number; // the lead division's latest gameweek
  lead: Story | null;
  stories: Story[];
  latest: Result[]; // the latest week's results across all divisions, newest first
  ticker: Result[];
  tables: MiniTable[];
  upcoming: Result[];
  numbers: { label: string; value: string; detail: string }[];
  team: (id: number | null, fallback: string) => Team;
};

export async function getHomeData(): Promise<HomeData | null> {
  const index = await getIndex();
  const ref = index.seasons.find((s) => s.isCurrent) ?? index.seasons[0];
  const season = ref && (await getSeason(ref.slug));
  if (!season) return null;

  const teams = new Map(season.teams.map((t) => [t.id, t]));
  const team = (id: number | null, fallback: string): Team =>
    (id !== null && teams.get(id)) || { id: id ?? 0, name: fallback, colours: null };
  const divisionOf = new Map<number, Division>();
  for (const d of season.divisions) for (const p of d.pools) for (const id of p.teamIds) divisionOf.set(id, d);
  const href = (d: Division) => `/${season.season.slug}/${d.slug}`;

  // One league-wide gameweek numbering so the home page talks about a single "Gameweek N".
  const { matches } = withGameweeks(season.matches);
  const withDivision = (m: GwMatch): Result | null => {
    const d = divisionOf.get(m.home ?? -1) ?? divisionOf.get(m.away ?? -1);
    return d ? { ...m, division: d } : null;
  };
  const results = matches.filter(isPlayed).map(withDivision).filter((m): m is Result => m !== null);
  const gameweek = results.length ? Math.max(...results.map((m) => m.gw)) : 1;
  const newestFirst = (a: Result, b: Result) => b.kickoff.localeCompare(a.kickoff);
  const latest = results.filter((m) => m.gw === gameweek).sort(newestFirst);

  const tableFor = (d: Division, upto: number) => standings(d.pools[0].teamIds, matches, upto);

  // Lead story: the top of the Men's Premier League.
  let lead: Story | null = null;
  let leadGameweek = gameweek;
  const leadDiv = season.divisions.find((d) => d.slug === LEAD_DIVISION);
  if (leadDiv) {
    const now = tableFor(leadDiv, gameweek), before = tableFor(leadDiv, gameweek - 1);
    const [first, second] = now;
    // Division pages number gameweeks from the division's own first match; use that numbering here too.
    const ids = new Set(leadDiv.pools.flatMap((p) => p.teamIds));
    const own = withGameweeks(season.matches.filter((m) => ids.has(m.home ?? -1) || ids.has(m.away ?? -1)));
    const played = own.matches.filter(isPlayed);
    if (played.length) leadGameweek = Math.max(...played.map((m) => m.gw));
    if (first?.p) {
      const t = team(first.id, ""), stayed = before[0]?.id === first.id && before[0].p > 0;
      const gap = second ? first.pts - second.pts : 0;
      lead = {
        kicker: `Gameweek ${leadGameweek}`,
        title: `${t.name} ${stayed ? "stay" : "go"} top of the ${leadDiv.name}`,
        body: `${first.pts} points from ${first.p} games${second ? (gap > 0
          ? `, ${gap} clear of ${team(second.id, "").name}.`
          : `, level on points with ${team(second.id, "").name} and ahead on tiebreakers.`) : "."}`,
        href: href(leadDiv),
        teams: [t],
      };
    }
  }

  // Side stories, all computed from results.
  const stories: Story[] = [];
  const score = (m: Result) => `${m.hs}–${m.as}`;
  const margin = (m: Result) => Math.abs(m.hs! - m.as!);
  const biggest = [...latest].sort((a, b) => margin(b) - margin(a) || (b.hs! + b.as!) - (a.hs! + a.as!))[0];
  if (biggest && margin(biggest) > 0) {
    const homeWon = biggest.hs! > biggest.as!;
    const w = team(homeWon ? biggest.home : biggest.away, homeWon ? biggest.homeName : biggest.awayName);
    const l = team(homeWon ? biggest.away : biggest.home, homeWon ? biggest.awayName : biggest.homeName);
    stories.push({
      kicker: "Biggest win", title: `${w.name} ${homeWon ? "beat" : "won at"} ${l.name}`,
      body: `${score(biggest)} in the ${biggest.division.name}.`, href: href(biggest.division), teams: [w, l],
    });
  }
  const goals = [...latest].filter((m) => m !== biggest).sort((a, b) => (b.hs! + b.as!) - (a.hs! + a.as!))[0];
  if (goals && goals.hs! + goals.as! >= 6) {
    const h = team(goals.home, goals.homeName), a = team(goals.away, goals.awayName);
    stories.push({
      kicker: "Goal fest", title: `${goals.hs! + goals.as!} goals as ${h.name} and ${a.name} meet`,
      body: `${h.name} ${score(goals)} ${a.name}, ${goals.division.name}.`, href: href(goals.division), teams: [h, a],
    });
  }
  const runs = season.divisions.flatMap((d) => d.pools.flatMap((p) => standings(p.teamIds, matches, gameweek).map((r) => {
    let n = 0;
    for (let i = r.games.length - 1; i >= 0 && r.games[i].o !== "L"; i--) n++;
    return { r, d, n, perfect: r.p > 0 && r.w === r.p };
  })));
  const best = runs.sort((a, b) => b.n - a.n || b.r.pts - a.r.pts)[0];
  if (best && best.n >= 4) {
    const t = team(best.r.id, "");
    stories.push({
      kicker: best.perfect ? "Perfect record" : "Unbeaten run",
      title: best.perfect ? `${t.name} have won all ${best.r.p}` : `${t.name} unbeaten in ${best.n}`,
      body: `${best.r.pts} points so far in the ${best.d.name}.`, href: href(best.d), teams: [t],
    });
  }

  const tables: MiniTable[] = FEATURED.map((slug) => season.divisions.find((d) => d.slug === slug))
    .filter((d): d is Division => !!d)
    .map((d) => ({ division: d, href: href(d), rows: tableFor(d, gameweek).slice(0, 4).map((r) => ({ ...r, team: team(r.id, "") })) }));

  const nowIso = index.generatedAt.slice(0, 16);
  const upcoming = matches.filter((m) => !isPlayed(m) && m.kickoff > nowIso)
    .map(withDivision).filter((m): m is Result => m !== null)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 12);

  // Season in numbers.
  const all = results.filter((m) => m.type === "Regular Season");
  const totalGoals = all.reduce((s, m) => s + m.hs! + m.as!, 0);
  const allRows = runs.map((x) => x);
  const attack = [...allRows].sort((a, b) => b.r.gf - a.r.gf)[0];
  const defence = allRows.filter((x) => x.r.p >= 5).sort((a, b) => a.r.ga / a.r.p - b.r.ga / b.r.p)[0];
  const seasonBiggest = [...all].sort((a, b) => margin(b) - margin(a))[0];
  const numbers = [
    { label: "Matches played", value: String(all.length), detail: `${season.divisions.length} divisions` },
    { label: "Goals", value: String(totalGoals), detail: `${all.length ? (totalGoals / all.length).toFixed(1) : 0} per game` },
  ];
  if (attack) numbers.push({ label: "Best attack", value: String(attack.r.gf), detail: `${team(attack.r.id, "").name}, ${attack.d.name}` });
  if (defence) numbers.push({ label: "Meanest defence", value: (defence.r.ga / defence.r.p).toFixed(1), detail: `conceded per game, ${team(defence.r.id, "").name}` });
  if (seasonBiggest) numbers.push({
    label: "Biggest win", value: score(seasonBiggest),
    detail: `${team(seasonBiggest.home, seasonBiggest.homeName).name} v ${team(seasonBiggest.away, seasonBiggest.awayName).name}`,
  });

  return {
    seasonName: season.season.name, seasonSlug: season.season.slug, generatedAt: index.generatedAt, gameweek: leadGameweek,
    lead, stories, latest, ticker: [...results].sort(newestFirst).slice(0, 16), tables, upcoming, numbers, team,
  };
}
