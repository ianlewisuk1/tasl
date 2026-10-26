"use client";

import Link from "next/link";
import { useState } from "react";

import { Crest } from "@/lib/crest";

type Entry = { slug: string; name: string; teamId: number; colours: string | null; titles: number; seasons: number; latest: string };

export function ClubDirectory({ groups, total }: { groups: { family: string; label: string; clubs: Entry[] }[]; total: number }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, clubs: g.clubs.filter((c) => !needle || c.name.toLowerCase().includes(needle)) }))
    .filter((g) => g.clubs.length);
  return (
    <>
      <div className="filters">
        <label className="search">
          <span className="sr">Find a club</span>
          <input id="club-search" type="search" placeholder={`Search ${total} clubs`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {shown.length === 0 && <p className="empty">No club matches “{q}”.</p>}
      {shown.map((g) => (
        <section key={g.family} className="clubgroup">
          <h2>{g.label}</h2>
          <div className="clublist">
            {g.clubs.map((c) => (
              <Link key={c.slug} href={`/clubs/${c.slug}`} className="clubitem">
                <Crest team={{ id: c.teamId, name: c.name, colours: c.colours }} size={28} />
                <span>
                  <b>{c.name}</b>
                  <small>{c.latest} · {c.seasons} season{c.seasons === 1 ? "" : "s"}{c.titles ? ` · ${c.titles} title${c.titles === 1 ? "" : "s"}` : ""}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
