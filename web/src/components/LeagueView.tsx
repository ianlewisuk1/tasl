"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useSyncExternalStore } from "react";

import { Crest } from "@/lib/crest";
import { type Game, type GwMatch, type HomeAway, type Row, isPlayed, standings } from "@/lib/table";
import type { DivisionView, Team } from "@/lib/types";

type View = "table" | "results" | "fixtures";
const TITLES: Record<View, string> = { table: "Table", results: "Results", fixtures: "Fixtures" };
const RELEGATION_MIN_TEAMS = 6;
const FOLLOW_KEY = "tasl-follow";

const toDate = (iso: string) => new Date(iso.length === 16 ? `${iso}:00` : iso);
const fmtShort = (iso: string) => toDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDay = (iso: string) => toDate(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const fmtTime = (iso: string) => toDate(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const outcomeWord = { W: "Won", D: "Drew", L: "Lost" } as const;

/** Static pages are built ahead of time, so the server renders with the data timestamp and the browser uses its own clock. */
const PAGE_LOADED_AT = typeof window === "undefined" ? 0 : Date.now();
const noSubscribe = () => () => {};
function useNow(initial: string) {
  return useSyncExternalStore(noSubscribe, () => PAGE_LOADED_AT, () => new Date(initial).getTime());
}

/** Followed team, kept in this browser only. */
function subscribeFollow(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(FOLLOW_KEY, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(FOLLOW_KEY, cb);
  };
}
function readFollow(): number | null {
  try {
    return Number(localStorage.getItem(FOLLOW_KEY)) || null;
  } catch {
    return null;
  }
}
function useFollow(): [number | null, (id: number | null) => void] {
  const follow = useSyncExternalStore(subscribeFollow, readFollow, () => null);
  const set = (id: number | null) => {
    try {
      if (id) localStorage.setItem(FOLLOW_KEY, String(id));
      else localStorage.removeItem(FOLLOW_KEY);
    } catch {}
    window.dispatchEvent(new Event(FOLLOW_KEY));
  };
  return [follow, set];
}

export function LeagueView({ view }: { view: DivisionView }) {
  const router = useRouter();
  const now = useNow(view.generatedAt);
  const teams = useMemo(() => new Map(view.teams.map((t) => [t.id, t])), [view.teams]);
  const played = useMemo(() => view.matches.filter(isPlayed), [view.matches]);
  const lastGw = played.length ? Math.max(...played.map((m) => m.gw)) : 1;

  const [tab, setTab] = useState<View>("table");
  const [gw, setGw] = useState(lastGw);
  const [ha, setHa] = useState<HomeAway>("all");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [follow, setFollow] = useFollow();
  const toggleFollow = (id: number) => setFollow(follow === id ? null : id);
  const toggleOpen = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const team = (id: number | null, fallback: string): Team =>
    (id !== null && teams.get(id)) || { id: id ?? 0, name: fallback, colours: null };

  return (
    <>
      <div className="hero">
        <div className="wrap">
          <h1>{TITLES[tab]}</h1>
        </div>
        <div className="subnav">
          <div className="wrap" role="tablist" aria-label="View">
            {(Object.keys(TITLES) as View[]).map((v) => (
              <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}>
                {TITLES[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="wrap">
        <div className="filters">
          <label className="sel">
            <span className="sr">Division</span>
            <select
              id="f-div"
              value={view.division.slug}
              onChange={(e) => router.push(`/${view.season.slug}/${e.target.value}`)}
            >
              {view.divisions.map((d) => (
                <option key={d.slug} value={d.slug}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="sel">
            <span className="sr">Season</span>
            <select
              id="f-season"
              value={view.season.slug}
              onChange={(e) => router.push(`/${e.target.value}/${view.division.slug}`)}
            >
              {view.seasons.map((s) => (
                <option key={s.slug} value={s.slug} disabled={!s.hasDivision}>
                  {s.name}{s.hasDivision ? "" : " (no " + view.division.name + ")"}
                </option>
              ))}
            </select>
          </label>
          {tab !== "fixtures" && (
            <label className="sel">
              <span className="sr">Gameweek</span>
              <select id="f-gw" value={gw === lastGw ? "all" : gw} onChange={(e) => setGw(e.target.value === "all" ? lastGw : Number(e.target.value))}>
                <option value="all">All Gameweeks</option>
                {Array.from({ length: lastGw }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Gameweek {i + 1}</option>
                ))}
              </select>
            </label>
          )}
          {tab === "table" && (
            <label className="sel">
              <span className="sr">Home and away</span>
              <select id="f-ha" value={ha} onChange={(e) => setHa(e.target.value as HomeAway)}>
                <option value="all">Home &amp; Away</option>
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
            </label>
          )}
          <button className="reset" disabled={gw === lastGw && ha === "all"} onClick={() => { setGw(lastGw); setHa("all"); }}>
            Reset <span aria-hidden="true">↺</span>
          </button>
        </div>

        {tab === "table" && (
          <section>
            {view.division.pools.map((pool, i) => (
              <PoolTable
                key={pool.name ?? i}
                title={view.division.pools.length > 1 ? pool.name : null}
                teamIds={pool.teamIds}
                matches={view.matches}
                gw={gw}
                lastGw={lastGw}
                ha={ha}
                now={now}
                team={team}
                open={open}
                toggleOpen={toggleOpen}
                follow={follow}
                toggleFollow={toggleFollow}
              />
            ))}
            <div className="key">
              <span><i />Champion</span>
              <span><i className="r" />Relegation</span>
            </div>
            <div className="notes">
              <span>Tiebreakers, in order: head-to-head, goal difference capped at 3 per game, fewest goals against, most shutouts.</span>
              <span>Select a team to see its season. The star follows a team on this device.</span>
            </div>
          </section>
        )}
        {tab === "results" && (
          <MatchList matches={played.filter((m) => m.gw <= gw)} desc now={now} team={team} />
        )}
        {tab === "fixtures" && (
          <MatchList matches={view.matches.filter((m) => !isPlayed(m))} now={now} team={team} />
        )}

        <div className="notes foot">
          <span>
            Data from the league&apos;s public TeamPass pages, updated {fmtShort(view.generatedAt.slice(0, 16))}.
            Standings are computed from results and checked against TeamPass&apos;s official table.
          </span>
          <span>Crests use each team&apos;s listed kit colours. Teams with no colours on file get an assigned colour.</span>
        </div>
      </main>
    </>
  );
}

type PoolProps = {
  title: string | null;
  teamIds: number[];
  matches: GwMatch[];
  gw: number;
  lastGw: number;
  ha: HomeAway;
  now: number;
  team: (id: number | null, fallback: string) => Team;
  open: Set<number>;
  toggleOpen: (id: number) => void;
  follow: number | null;
  toggleFollow: (id: number) => void;
};

function PoolTable(props: PoolProps) {
  const { teamIds, matches, gw, lastGw, ha, now, team, open, toggleOpen, follow, toggleFollow } = props;
  const table = useMemo(() => standings(teamIds, matches, gw, ha), [teamIds, matches, gw, ha]);
  const prev = useMemo(() => (gw > 1 ? standings(teamIds, matches, gw - 1, ha) : null), [teamIds, matches, gw, ha]);
  const n = table.length;

  const nextFor = (id: number) =>
    matches.find(
      (m) => (m.home === id || m.away === id) && !isPlayed(m) &&
        (gw === lastGw ? toDate(m.kickoff).getTime() > now : m.gw > gw),
    ) ?? (gw === lastGw ? undefined : matches.find((m) => (m.home === id || m.away === id) && m.gw > gw));

  return (
    <div className="pool">
      {props.title && <h2 className="pooltitle">{props.title}</h2>}
      <div className="tablebox">
        <table>
          <thead>
            <tr>
              <th className="l" colSpan={2}>Pos</th>
              <th className="l">Team</th>
              <th title="Played">Pl</th>
              <th className="hide-sm" title="Won">W</th>
              <th className="hide-sm" title="Drawn">D</th>
              <th className="hide-sm" title="Lost">L</th>
              <th className="hide-md" title="Goals for">GF</th>
              <th className="hide-md" title="Goals against">GA</th>
              <th title="Goal difference">GD</th>
              <th title="Points">Pts</th>
              <th>Form</th>
              <th className="hide-md">Next</th>
              <th><span className="sr">Follow</span></th>
            </tr>
          </thead>
          <tbody>
            {table.map((r) => {
              const t = team(r.id, "");
              const was = prev?.find((p) => p.id === r.id)?.pos;
              const diff = was ? was - r.pos : 0;
              const zone = !r.p ? "" : r.pos === 1 ? "zone-champ" : n >= RELEGATION_MIN_TEAMS && r.pos > n - 2 ? "zone-releg" : "";
              const isOpen = open.has(r.id);
              const nx = nextFor(r.id);
              const opp = nx ? team(nx.home === r.id ? nx.away : nx.home, nx.home === r.id ? nx.awayName : nx.homeName) : null;
              const last5 = r.games.slice(-5);
              return (
                <Fragment key={r.id}>
                  <tr
                    className={["row", zone, follow === r.id && "followed", isOpen && "open"].filter(Boolean).join(" ")}
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggleOpen(r.id)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                        e.preventDefault();
                        toggleOpen(r.id);
                      }
                    }}
                  >
                    <td className="pos">{r.pos}</td>
                    <td className="mv">
                      {diff > 0 ? <span className="chev up" title={`Up ${diff} since gameweek ${gw - 1}`} />
                        : diff < 0 ? <span className="chev down" title={`Down ${-diff} since gameweek ${gw - 1}`} />
                        : <span className="dash" title="No change" />}
                    </td>
                    <td className="team">
                      <div className="teamcell">
                        <Crest team={t} />
                        <span className="nm">{t.name}</span>
                        {zone === "zone-champ" && <Trophy />}
                      </div>
                    </td>
                    <td className="n">{r.p}</td>
                    <td className="n hide-sm">{r.w}</td>
                    <td className="n hide-sm">{r.d}</td>
                    <td className="n hide-sm">{r.l}</td>
                    <td className="n hide-md">{r.gf}</td>
                    <td className="n hide-md">{r.ga}</td>
                    <td className="n" title={`Capped GD (tiebreaker): ${signed(r.gd3)}`}>{r.gf - r.ga}</td>
                    <td className="pts">{r.pts}</td>
                    <td className="form">
                      <span className="formrow">
                        {Array.from({ length: 5 }, (_, i) => {
                          const g = last5[i - (5 - last5.length)];
                          return g ? (
                            <span key={i} className={`fp ${g.o}`} title={`GW${g.m.gw}: ${outcomeWord[g.o]} ${g.f}–${g.a} ${g.home ? "vs" : "at"} ${team(g.op, "").name}`}>{g.o}</span>
                          ) : <span key={i} className="fp x" />;
                        })}
                      </span>
                    </td>
                    <td className="next hide-md">
                      {nx && opp ? (
                        <span title={`Next: ${nx.home === r.id ? "vs" : "at"} ${opp.name}, ${fmtShort(nx.kickoff)} ${fmtTime(nx.kickoff)}${nx.venue ? `, ${nx.venue}` : ""}`}>
                          <Crest team={opp} />
                        </span>
                      ) : <span className="dash" />}
                    </td>
                    <td className="star">
                      <button
                        className="starbtn"
                        aria-pressed={follow === r.id}
                        aria-label={`Follow ${t.name}`}
                        onClick={(e) => { e.stopPropagation(); toggleFollow(r.id); }}
                      >
                        {follow === r.id ? "★" : "☆"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && <Detail r={r} gw={gw} ha={ha} matches={matches} teamIds={teamIds} now={now} team={team} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detail({ r, gw, ha, matches, teamIds, now, team }: {
  r: Row; gw: number; ha: HomeAway; matches: GwMatch[]; teamIds: number[]; now: number;
  team: (id: number | null, fallback: string) => Team;
}) {
  const positions = useMemo(
    () => Array.from({ length: gw }, (_, i) => standings(teamIds, matches, i + 1, ha).find((x) => x.id === r.id)!.pos),
    [teamIds, matches, gw, ha, r.id],
  );
  const upcoming = matches.filter(
    (m) => (m.home === r.id || m.away === r.id) && (!isPlayed(m) || m.gw > gw) &&
      (ha === "all" || (ha === "home") === (m.home === r.id)),
  );
  const per = (v: number) => (r.p ? (v / r.p).toFixed(1) : "–");
  return (
    <tr className="detail">
      <td colSpan={14}>
        <div className="detailin">
          <div>
            <h3>Position by gameweek</h3>
            <PositionChart positions={positions} teams={teamIds.length} />
            <div className="stats">
              <div className="stat"><b>{per(r.gf)}</b><span>Scored per game</span></div>
              <div className="stat"><b>{per(r.ga)}</b><span>Conceded per game</span></div>
              <div className="stat"><b>{r.cs}</b><span>Clean sheets</span></div>
              <div className="stat"><b>{signed(r.gd3)}</b><span>Capped GD</span></div>
            </div>
          </div>
          <div>
            <h3>Results</h3>
            <div className="games">
              {r.games.length ? [...r.games].reverse().map((g: Game) => (
                <div className="g" key={g.m.id}>
                  <span className="gw">GW{g.m.gw}</span>
                  <span className={`fp ${g.o}`}>{g.o}</span>
                  <Crest team={team(g.op, "")} size={18} />
                  <span className="o">{g.home ? "" : "at "}{team(g.op, "").name}</span>
                  <span className="s">{g.f}–{g.a}{g.m.forfeit && <span className="tag">forfeit</span>}</span>
                </div>
              )) : <span className="tag">No games yet</span>}
            </div>
            {upcoming.length > 0 && (
              <>
                <h3>Coming up</h3>
                <div className="games">
                  {upcoming.map((m) => {
                    const home = m.home === r.id;
                    const op = team(home ? m.away : m.home, home ? m.awayName : m.homeName);
                    const pending = !isPlayed(m) && toDate(m.kickoff).getTime() < now;
                    return (
                      <div className="g" key={m.id}>
                        <span className="gw">GW{m.gw}</span>
                        <span className="ha">{home ? "H" : "A"}</span>
                        <Crest team={op} size={18} />
                        <span className="o">{op.name}</span>
                        <span className="tag">{pending ? (m.status === "scheduled" ? "Result pending" : m.status) : `${fmtShort(m.kickoff)}, ${fmtTime(m.kickoff)}`}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function PositionChart({ positions, teams }: { positions: number[]; teams: number }) {
  const W = 320, H = 130, L = 22, R = 10, T = 10, B = 22;
  const n = Math.max(teams, 2);
  const x = (i: number) => L + (positions.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (positions.length - 1));
  const y = (p: number) => T + ((p - 1) * (H - T - B)) / (n - 1);
  const marks = [...new Set([1, Math.ceil(n / 2), n])];
  const ticks = positions.map((_, i) => i).filter((i) => positions.length <= 8 || i % 2 === 0 || i === positions.length - 1);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="League position by gameweek">
      <defs>
        <linearGradient id="lg" x1="0" x2="1">
          <stop offset="0" stopColor="#9b2cf7" />
          <stop offset="1" stopColor="#4fe8f5" />
        </linearGradient>
      </defs>
      {marks.map((p) => (
        <g key={p}>
          <line className="grid" x1={L} x2={W - R} y1={y(p)} y2={y(p)} />
          <text className="ax" x={L - 7} y={y(p) + 3} textAnchor="end">{p}</text>
        </g>
      ))}
      {ticks.map((i) => <text key={i} className="ax" x={x(i)} y={H - 5} textAnchor="middle">{i + 1}</text>)}
      <path className="ln" d={positions.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p).toFixed(1)}`).join("")} />
      {positions.map((p, i) => (
        <circle key={i} className={`dot${i === positions.length - 1 ? " last" : ""}`} cx={x(i)} cy={y(p)} r={i === positions.length - 1 ? 4.5 : 3}>
          <title>{`Gameweek ${i + 1}: position ${p}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function MatchList({ matches, desc, now, team }: {
  matches: GwMatch[]; desc?: boolean; now: number; team: (id: number | null, fallback: string) => Team;
}) {
  const byGw = new Map<number, GwMatch[]>();
  for (const m of matches) byGw.set(m.gw, [...(byGw.get(m.gw) ?? []), m]);
  const gws = [...byGw.keys()].sort((a, b) => (desc ? b - a : a - b));
  if (!gws.length) return <p className="empty">Nothing to show.</p>;
  return (
    <section>
      {gws.map((gw) => {
        const list = byGw.get(gw)!.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
        const days = new Map<string, GwMatch[]>();
        for (const m of list) days.set(m.kickoff.slice(0, 10), [...(days.get(m.kickoff.slice(0, 10)) ?? []), m]);
        return (
          <div key={gw}>
            <div className="gwhead">
              <h2>Gameweek {gw}</h2>
              <span>{fmtShort(list[0].kickoff)} – {fmtShort(list[list.length - 1].kickoff)}</span>
            </div>
            {[...days.entries()].map(([day, ms]) => (
              <div key={day}>
                <div className="day">{fmtDay(ms[0].kickoff)}</div>
                {ms.map((m) => {
                  const h = team(m.home, m.homeName), a = team(m.away, m.awayName);
                  const pending = !isPlayed(m) && toDate(m.kickoff).getTime() < now;
                  return (
                    <div className="fx" key={m.id}>
                      <div className="h"><span>{h.name}</span><Crest team={h} size={22} /></div>
                      {isPlayed(m) ? (
                        <div>
                          <div className="sc">{m.hs} - {m.as}</div>
                          {m.forfeit && <span className="ff">Forfeit</span>}
                        </div>
                      ) : pending ? (
                        <div className="sc pend">{m.status === "scheduled" ? "Result pending" : m.status}</div>
                      ) : (
                        <div className="sc ko">{fmtTime(m.kickoff)}</div>
                      )}
                      <div className="a"><Crest team={a} size={22} /><span>{a.name}</span></div>
                      <div className="ven">{[m.venue, m.pitch && `field ${m.pitch}`].filter(Boolean).join(", ")}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}

function Trophy() {
  return (
    <svg className="trophy" viewBox="0 0 16 16" role="img" aria-label="Leader">
      <path fill="currentColor" d="M4 1h8v1.5h2.5V5a3 3 0 0 1-3 3h-.2A4 4 0 0 1 9 9.9V12h2.5v2h-7v-2H7V9.9A4 4 0 0 1 4.7 8h-.2a3 3 0 0 1-3-3V2.5H4zM3 4v1a1.5 1.5 0 0 0 1 1.4V4zm10 0h-1v2.4A1.5 1.5 0 0 0 13 5z" />
    </svg>
  );
}
