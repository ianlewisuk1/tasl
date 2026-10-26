import type { Match } from "./types";

/** Matches with a gameweek number attached. */
export type GwMatch = Match & { gw: number };

const pad = (n: number) => String(n).padStart(2, "0");

/** Monday of the week containing `iso`, as "YYYY-MM-DD" (local, no timezone conversion). */
export function weekKey(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const x = new Date(y, m - 1, d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** Gameweek = each Mon–Sun week that has at least one scheduled match, numbered from the opener. */
export function withGameweeks(matches: Match[]): { matches: GwMatch[]; gameweeks: number } {
  const weeks = [...new Set(matches.map((m) => weekKey(m.kickoff)))].sort();
  return {
    matches: matches.map((m) => ({ ...m, gw: weeks.indexOf(weekKey(m.kickoff)) + 1 })),
    gameweeks: weeks.length,
  };
}

export const isPlayed = (m: Match) => m.status === "played" && m.hs !== null && m.as !== null;
export const counts = (m: Match) => isPlayed(m) && m.type === "Regular Season";

export type Outcome = "W" | "D" | "L";
export type Game = { m: GwMatch; o: Outcome; f: number; a: number; op: number; home: boolean };
export type Row = {
  id: number;
  p: number; w: number; d: number; l: number;
  gf: number; ga: number; gd3: number; pts: number; cs: number; h2h: number;
  pos: number;
  games: Game[];
};
export type HomeAway = "all" | "home" | "away";

/**
 * TASL table: W3 D1 L0. Ties: head-to-head points among the tied teams, goal difference capped at ±3 per
 * game, fewest goals against, most shutouts. Teams that have not played sit below everyone else. Only
 * regular-season matches between pool teams count.
 *
 * Head-to-head only applies when every pair of tied teams has met the same number of times (at least once),
 * otherwise it is skipped. This reproduces all of TeamPass's official tables from Spring 2023 on.
 */
export function standings(teamIds: number[], matches: GwMatch[], uptoGw: number, ha: HomeAway = "all"): Row[] {
  const ids = new Set(teamIds);
  const ms = matches
    .filter((m) => counts(m) && m.gw <= uptoGw && ids.has(m.home!) && ids.has(m.away!))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const rows = new Map<number, Row>(
    teamIds.map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd3: 0, pts: 0, cs: 0, h2h: 0, pos: 0, games: [] }]),
  );
  for (const m of ms) {
    const sides: [number, number, number, number, boolean][] = [
      [m.home!, m.away!, m.hs!, m.as!, true],
      [m.away!, m.home!, m.as!, m.hs!, false],
    ];
    for (const [me, op, f, a, home] of sides) {
      if (ha !== "all" && (ha === "home") !== home) continue;
      const r = rows.get(me)!;
      const o: Outcome = f > a ? "W" : f < a ? "L" : "D";
      r.p++; r.gf += f; r.ga += a; r.gd3 += Math.max(-3, Math.min(3, f - a));
      if (o === "W") { r.w++; r.pts += 3; } else if (o === "D") { r.d++; r.pts += 1; } else r.l++;
      if (a === 0 && o !== "L") r.cs++;
      r.games.push({ m, o, f, a, op, home });
    }
  }
  const byPts = new Map<number, Row[]>();
  for (const r of rows.values()) byPts.set(r.pts, [...(byPts.get(r.pts) ?? []), r]);
  for (const group of byPts.values()) {
    if (group.length < 2) continue;
    const tied = new Set(group.map((r) => r.id));
    const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    const meetings = new Map<string, number>();
    for (const m of ms) {
      if (tied.has(m.home!) && tied.has(m.away!)) meetings.set(pairKey(m.home!, m.away!), (meetings.get(pairKey(m.home!, m.away!)) ?? 0) + 1);
    }
    const counts = group.flatMap((a, i) => group.slice(i + 1).map((b) => meetings.get(pairKey(a.id, b.id)) ?? 0));
    if (counts.some((n) => n === 0) || new Set(counts).size !== 1) continue;
    for (const m of ms) {
      if (!tied.has(m.home!) || !tied.has(m.away!)) continue;
      const h = rows.get(m.home!)!, a = rows.get(m.away!)!;
      if (m.hs! > m.as!) h.h2h += 3;
      else if (m.hs! < m.as!) a.h2h += 3;
      else { h.h2h++; a.h2h++; }
    }
  }
  const list = [...rows.values()].sort(
    (a, b) => Number(a.p === 0) - Number(b.p === 0) || b.pts - a.pts || b.h2h - a.h2h || b.gd3 - a.gd3 || a.ga - b.ga || b.cs - a.cs || a.id - b.id,
  );
  list.forEach((r, i) => (r.pos = i + 1));
  return list;
}
