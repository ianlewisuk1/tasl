"""Storage. SQLite locally; SQL kept portable so it can move to Postgres unchanged."""
from __future__ import annotations

import datetime as dt
import pathlib
import sqlite3

from .parse import Pool, Season, TeamPage

SCHEMA = """
CREATE TABLE IF NOT EXISTS seasons (
    id          INTEGER PRIMARY KEY,         -- TeamPass season id
    name        TEXT NOT NULL,               -- "Fall 2026"
    term        TEXT NOT NULL,               -- "Fall", "Spring", "Summer Heat"
    year        INTEGER NOT NULL,
    sort        INTEGER NOT NULL,
    is_current  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pools (
    season_id   INTEGER NOT NULL REFERENCES seasons(id),
    title       TEXT NOT NULL,               -- TeamPass table heading, unique within a season
    division    TEXT NOT NULL,               -- "Women's 8v8 Recreation"
    name        TEXT,                        -- "Women's 8v8 Rec A", NULL when the division has one table
    sort        INTEGER NOT NULL,
    PRIMARY KEY (season_id, title)
);

CREATE TABLE IF NOT EXISTS teams (
    id          INTEGER PRIMARY KEY,         -- TeamPass team id (new id every season)
    season_id   INTEGER NOT NULL REFERENCES seasons(id),
    pool_title  TEXT NOT NULL,
    name        TEXT NOT NULL,
    colours     TEXT,
    scraped_at  TEXT
);

CREATE TABLE IF NOT EXISTS matches (
    id          TEXT PRIMARY KEY,            -- TeamPass event id, or a synthetic key when missing
    season_id   INTEGER NOT NULL REFERENCES seasons(id),
    kickoff     TEXT NOT NULL,               -- local time, ISO 8601
    venue       TEXT,
    pitch       TEXT,
    match_type  TEXT NOT NULL,               -- "Regular Season", playoffs, etc.
    home_id     INTEGER,
    away_id     INTEGER,
    home_name   TEXT NOT NULL,
    away_name   TEXT NOT NULL,
    home_score  INTEGER,
    away_score  INTEGER,
    status      TEXT NOT NULL,               -- "played", "scheduled", or TeamPass text e.g. "Cancelled"
    forfeit     INTEGER NOT NULL DEFAULT 0,
    home_guest_url TEXT,                     -- TeamPass guest-player signup for the home team in this game
    away_guest_url TEXT,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS matches_season ON matches (season_id, kickoff);

CREATE TABLE IF NOT EXISTS official_standings (
    season_id   INTEGER NOT NULL,
    pool_title  TEXT NOT NULL,
    team_id     INTEGER NOT NULL,
    rank        INTEGER NOT NULL,
    mp INTEGER, w INTEGER, d INTEGER, l INTEGER, gf INTEGER, ga INTEGER, gd3 INTEGER, pts INTEGER,
    scraped_at  TEXT NOT NULL,
    PRIMARY KEY (season_id, team_id)
);
"""


def connect(path: str) -> sqlite3.Connection:
    # data/ is gitignored, so it is missing on a fresh checkout (e.g. in CI).
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(matches)")}
    for col in ("home_guest_url", "away_guest_url"):
        if col not in cols:
            conn.execute(f"ALTER TABLE matches ADD COLUMN {col} TEXT")
    return conn


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def save_seasons(conn, seasons: list[Season], current_id: int):
    conn.executemany(
        """INSERT INTO seasons (id, name, term, year, sort, is_current) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET name = excluded.name, term = excluded.term, year = excluded.year,
             sort = excluded.sort, is_current = excluded.is_current""",
        [(s.id, s.name, s.term, s.year, i, int(s.id == current_id)) for i, s in enumerate(seasons)],
    )


def save_pools(conn, season_id: int, pools: list[Pool]):
    ts = now()
    for i, p in enumerate(pools):
        conn.execute(
            """INSERT INTO pools (season_id, title, division, name, sort) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT (season_id, title) DO UPDATE SET division = excluded.division, name = excluded.name, sort = excluded.sort""",
            (season_id, p.title, p.division, p.name, i),
        )
        for r in p.rows:
            conn.execute(
                """INSERT INTO teams (id, season_id, pool_title, name) VALUES (?, ?, ?, ?)
                   ON CONFLICT (id) DO UPDATE SET season_id = excluded.season_id, pool_title = excluded.pool_title, name = excluded.name""",
                (r.team_id, season_id, p.title, r.team_name),
            )
            conn.execute(
                """INSERT INTO official_standings (season_id, pool_title, team_id, rank, mp, w, d, l, gf, ga, gd3, pts, scraped_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (season_id, team_id) DO UPDATE SET pool_title = excluded.pool_title, rank = excluded.rank,
                     mp = excluded.mp, w = excluded.w, d = excluded.d, l = excluded.l, gf = excluded.gf, ga = excluded.ga,
                     gd3 = excluded.gd3, pts = excluded.pts, scraped_at = excluded.scraped_at""",
                (season_id, p.title, r.team_id, r.rank, r.mp, r.w, r.d, r.l, r.gf, r.ga, r.gd3, r.pts, ts),
            )


def save_team(conn, season_id: int, team: TeamPage) -> int:
    """Upsert a team's matches. Returns the number of matches that were new or changed."""
    ts = now()
    conn.execute("UPDATE teams SET colours = ?, scraped_at = ? WHERE id = ?", (team.colours, ts, team.id))
    changed = 0
    for m in team.matches:
        row = (m.key, season_id, m.kickoff.isoformat(timespec="minutes"), m.venue, m.pitch, m.match_type,
               m.home_id, m.away_id, m.home_name, m.away_name, m.home_score, m.away_score, m.status, int(m.forfeit))
        old = conn.execute(
            """SELECT id, season_id, kickoff, venue, pitch, match_type, home_id, away_id, home_name, away_name,
                      home_score, away_score, status, forfeit FROM matches WHERE id = ?""", (m.key,)).fetchone()
        if old is not None and tuple(old) == row:
            continue
        changed += 1
        conn.execute(
            """INSERT INTO matches (id, season_id, kickoff, venue, pitch, match_type, home_id, away_id, home_name, away_name,
                                    home_score, away_score, status, forfeit, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (id) DO UPDATE SET season_id = excluded.season_id, kickoff = excluded.kickoff, venue = excluded.venue,
                 pitch = excluded.pitch, match_type = excluded.match_type, home_id = excluded.home_id, away_id = excluded.away_id,
                 home_name = excluded.home_name, away_name = excluded.away_name, home_score = excluded.home_score,
                 away_score = excluded.away_score, status = excluded.status, forfeit = excluded.forfeit, updated_at = excluded.updated_at""",
            row + (ts,),
        )
    # Each team's page only carries its own guest link, so set just that side and leave the other alone.
    for m in team.matches:
        side = "home_guest_url" if m.home_id == team.id else "away_guest_url"
        cur = conn.execute(f"UPDATE matches SET {side} = ? WHERE id = ? AND {side} IS NOT ?", (m.guest_url, m.key, m.guest_url))
        changed += cur.rowcount
    return changed
