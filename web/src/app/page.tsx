import Link from "next/link";

import { Crest } from "@/lib/crest";
import { REGISTER_URL } from "@/lib/data";
import { type Result, getHomeData } from "@/lib/home";
import type { Team } from "@/lib/types";

const toDate = (iso: string) => new Date(`${iso.slice(0, 16)}:00`);
const fmtDay = (iso: string) => toDate(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const fmtShort = (iso: string) => toDate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (iso: string) => toDate(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default async function Home() {
  const data = await getHomeData();
  if (!data) return <main className="wrap"><p className="empty">No season data yet.</p></main>;
  const { team } = data;
  const side = (m: Result, home: boolean): Team => team(home ? m.home : m.away, home ? m.homeName : m.awayName);
  const divHref = (m: Result) => `/results/${data.seasonSlug}/${m.division.slug}`;

  const days = new Map<string, Result[]>();
  for (const m of data.upcoming) days.set(m.kickoff.slice(0, 10), [...(days.get(m.kickoff.slice(0, 10)) ?? []), m]);

  return (
    <>
      <div className="ticker" aria-label="Latest results">
        <div className="wrap">
          <span className="tickerlabel">Latest</span>
          <div className="tickertrack">
            {data.ticker.map((m) => (
              <Link key={m.id} href={divHref(m)} className="tick">
                <Crest team={side(m, true)} size={14} />
                <span>{side(m, true).name}</span>
                <b>{m.hs}–{m.as}</b>
                <span>{side(m, false).name}</span>
                <Crest team={side(m, false)} size={14} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main className="wrap home">
        <section className="topgrid">
          {data.lead && (
            <Link href={data.lead.href} className="lead">
              <div className="leadart" aria-hidden="true">
                <Crest team={data.lead.teams[0]} size={150} />
                <span className="leadgw">GW{data.gameweek}</span>
              </div>
              <div className="leadtext">
                <span className="kicker">{data.lead.kicker}</span>
                <h1>{data.lead.title}</h1>
                <p>{data.lead.body}</p>
                <span className="more">See the table</span>
              </div>
            </Link>
          )}

          <div className="stories">
            {data.stories.map((s) => (
              <Link key={s.title} href={s.href} className="story">
                <div>
                  <span className="kicker">{s.kicker}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
                <div className="storycrests" aria-hidden="true">
                  {s.teams.map((t) => <Crest key={t.id} team={t} size={40} />)}
                </div>
              </Link>
            ))}
          </div>

          <aside className="rail" aria-label="Latest results">
            <h2>Latest results</h2>
            <div className="railscroll">
              {data.latest.map((m) => (
                <Link key={m.id} href={divHref(m)} className="railrow">
                  <span className="raildiv">{m.division.name}</span>
                  <span className="railmatch">
                    <span className="rh">{side(m, true).name}</span>
                    <Crest team={side(m, true)} size={18} />
                    <b>{m.hs} - {m.as}</b>
                    <Crest team={side(m, false)} size={18} />
                    <span className="ra">{side(m, false).name}</span>
                  </span>
                  <span className="ft">FT</span>
                </Link>
              ))}
            </div>
          </aside>
        </section>

        <section>
          <div className="sectionhead">
            <h2>League tables</h2>
            <span>{data.seasonName}</span>
          </div>
          <div className="minigrid">
            {data.tables.map((t) => (
              <Link key={t.division.slug} href={t.href} className="mini">
                <h3>{t.division.name}</h3>
                <table>
                  <thead><tr><th className="l">Pos</th><th className="l">Team</th><th>Pl</th><th>GD</th><th>Pts</th></tr></thead>
                  <tbody>
                    {t.rows.map((r) => (
                      <tr key={r.id} className={r.pos === 1 && r.p ? "lead1" : undefined}>
                        <td className="l">{r.pos}</td>
                        <td className="l"><span className="mt"><Crest team={r.team} size={16} /><span>{r.team.name}</span></span></td>
                        <td>{r.p}</td>
                        <td>{r.gf - r.ga}</td>
                        <td className="b">{r.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <span className="more">Full table</span>
              </Link>
            ))}
          </div>
        </section>

        {data.upcoming.length > 0 && (
          <section>
            <div className="sectionhead">
              <h2>Coming up</h2>
              <span>Next {data.upcoming.length} matches</span>
            </div>
            {[...days.entries()].map(([day, ms]) => (
              <div key={day}>
                <div className="day">{fmtDay(ms[0].kickoff)}</div>
                {ms.map((m) => (
                  <Link key={m.id} href={`/fixtures/${data.seasonSlug}/${m.division.slug}`} className="fx">
                    <div className="h"><span>{side(m, true).name}</span><Crest team={side(m, true)} size={22} /></div>
                    <div className="sc ko">{fmtTime(m.kickoff)}</div>
                    <div className="a"><Crest team={side(m, false)} size={22} /><span>{side(m, false).name}</span></div>
                    <div className="ven">{m.division.name}{m.venue ? ` · ${m.venue}` : ""}</div>
                  </Link>
                ))}
              </div>
            ))}
          </section>
        )}

        <section>
          <div className="sectionhead">
            <h2>Season in numbers</h2>
            <span>{data.seasonName}, all divisions</span>
          </div>
          <div className="numbers">
            {data.numbers.map((n) => (
              <div key={n.label} className="num">
                <span className="kicker">{n.label}</span>
                <b>{n.value}</b>
                <span>{n.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <a className="banner" href={REGISTER_URL} target="_blank" rel="noopener noreferrer">
          <div>
            <b>Play in North Carolina&apos;s largest adult soccer league</b>
            <span>Register as a player, a captain or a free agent on TeamPass.</span>
          </div>
          <span className="bannerbtn">Register now</span>
        </a>

        <div className="notes foot">
          <span>
            Data from the league&apos;s public TeamPass pages, updated {fmtShort(data.generatedAt)}. Stories are generated from results.
          </span>
        </div>
      </main>
    </>
  );
}
