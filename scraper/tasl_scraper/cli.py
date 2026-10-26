"""Command line: scrape seasons into the database and check computed tables against TeamPass."""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

from . import db
from .client import TeamPass
from .parse import parse_standings, parse_team
from .standings import Result, compute

REPO = pathlib.Path(__file__).resolve().parents[2]


def scrape(args) -> int:
    conn = db.connect(args.db)
    tp = TeamPass(delay=args.delay, raw_dir=pathlib.Path(args.raw) if args.raw else None)
    current = parse_standings(tp.standings())
    db.save_seasons(conn, current.seasons, current.current_season.id)
    conn.commit()

    if args.season == "current":
        targets = [current.current_season]
    elif args.season == "all":
        targets = current.seasons
    else:
        targets = [s for s in current.seasons if str(s.id) == args.season or s.name == args.season]
        if not targets:
            print(f"Unknown season {args.season!r}. Known: {', '.join(s.name for s in current.seasons)}", file=sys.stderr)
            return 2

    for season in targets:
        page = current if season.id == current.current_season.id else parse_standings(tp.standings(season.id))
        if page.current_season is None:
            print(f"{season.name}: no standings published, skipping", flush=True)
            continue
        if page.current_season.id != season.id:
            print(f"{season.name}: TeamPass returned {page.current_season.name} instead, skipping", file=sys.stderr)
            continue
        db.save_pools(conn, season.id, page.pools)
        conn.commit()
        team_ids = [r.team_id for p in page.pools for r in p.rows]
        print(f"{season.name}: {len(page.pools)} tables, {len(team_ids)} teams", flush=True)
        changed = 0
        for i, team_id in enumerate(team_ids, 1):
            try:
                team = parse_team(tp.team(team_id), team_id, season.year)
            except Exception as e:  # one bad page must not stop the run
                print(f"  team {team_id}: {type(e).__name__}: {e}", file=sys.stderr)
                continue
            changed += db.save_team(conn, season.id, team)
            conn.commit()
            if i % 25 == 0:
                print(f"  {i}/{len(team_ids)} teams", flush=True)
        print(f"  {changed} matches new or changed", flush=True)
    return 0


def verify(args) -> int:
    conn = db.connect(args.db)
    seasons = conn.execute(
        "SELECT * FROM seasons WHERE is_current = 1" if args.season == "current" else
        "SELECT * FROM seasons" if args.season == "all" else
        "SELECT * FROM seasons WHERE id = ? OR name = ?",
        () if args.season in ("current", "all") else (args.season, args.season),
    ).fetchall()
    bad = 0
    for s in seasons:
        pools = conn.execute("SELECT title FROM pools WHERE season_id = ? ORDER BY sort", (s["id"],)).fetchall()
        ok = 0
        for p in pools:
            official = conn.execute(
                "SELECT * FROM official_standings WHERE season_id = ? AND pool_title = ? ORDER BY rank",
                (s["id"], p["title"])).fetchall()
            if not official:
                continue
            ids = [o["team_id"] for o in official]
            results = [Result(m["home_id"], m["away_id"], m["home_score"], m["away_score"]) for m in conn.execute(
                """SELECT * FROM matches WHERE season_id = ? AND status = 'played' AND match_type = 'Regular Season'
                   ORDER BY kickoff""", (s["id"],))]
            table = compute(ids, results)
            ours = [(r.team_id, r.p, r.pts) for r in table]
            theirs = [(o["team_id"], o["mp"], o["pts"]) for o in official]
            if ours == theirs:
                ok += 1
                continue
            bad += 1
            names = dict(conn.execute("SELECT id, name FROM teams WHERE season_id = ?", (s["id"],)).fetchall())
            print(f"MISMATCH {p['title']}")
            for (ti, tp_, tpts), (oi, op, opts) in zip(ours, theirs):
                flag = "" if (ti, tp_, tpts) == (oi, op, opts) else "  <--"
                print(f"   ours {names.get(ti, ti)[:24]:24} P{tp_:>2} {tpts:>3}pts | official {names.get(oi, oi)[:24]:24} P{op:>2} {opts:>3}pts{flag}")
        print(f"{s['name']}: {ok}/{len([p for p in pools])} tables match")
    return 1 if bad else 0


NOT_DIVISIONS = {"Guest Players", "More Teams!"}

# Men's and co-ed league divisions are shown with English football pyramid names. TeamPass renamed some
# divisions over the years (Mens 1 -> Triangle Men's Premier League, Coed Championship -> Coed Select);
# old and new names map to the same division so a team's history lines up across seasons.
MENS_PYRAMID = ["The Premier League", "The Championship", "League One", "League Two", "National League"]
COED_PYRAMID = [
    "Co-ed Premier League", "Co-ed Championship", "Co-ed League One", "Co-ed League Two",
    "Co-ed National League", "Co-ed National League North",
]
DISPLAY_NAMES = {
    "Triangle Men's Premier League": "The Premier League",
    "Mens 1": "The Premier League",
    "Mens 2": "The Championship",
    "Mens 3": "League One",
    "Mens 4": "League Two",
    "Mens 5": "National League",
    "Coed Premier Championship": "Co-ed Premier League",
    "Coed Select": "Co-ed Championship",
    "Coed Championship": "Co-ed Championship",
    "Coed Cup": "Co-ed League One",
    "Coed Eight - 1": "Co-ed League Two",
    "Coed Eight - 2": "Co-ed National League",
    "Coed Eight - 3": "Co-ed National League North",
}


def division_order(name: str, teampass_sort: int) -> tuple:
    """Dropdown order: men's pyramid, other men's, co-ed pyramid, other co-ed, then everything else (premier tiers first)."""
    if name in MENS_PYRAMID:
        return (0, MENS_PYRAMID.index(name))
    if name.startswith("Men"):
        return (1, teampass_sort)
    if name in COED_PYRAMID:
        return (2, COED_PYRAMID.index(name))
    if name.startswith(("Coed", "Co-ed")):
        return (3, teampass_sort)
    return (4, 0 if "Premier" in name else 1, teampass_sort)


def slugify(s: str) -> str:
    return re.sub(r"^the-", "", re.sub(r"[^a-z0-9]+", "-", s.lower().replace("'", "")).strip("-"))


def export(args) -> int:
    """Write one JSON file per season plus an index, for the web app to build from."""
    conn = db.connect(args.db)
    out = pathlib.Path(args.out)
    (out / "seasons").mkdir(parents=True, exist_ok=True)
    seasons = conn.execute("SELECT * FROM seasons ORDER BY sort DESC").fetchall()
    # Scheduled runs scrape only the current season, so keep previously exported seasons as they are.
    old_index = out / "index.json"
    previous = {s["slug"]: s for s in json.loads(old_index.read_text())["seasons"]} if old_index.exists() else {}
    index = {"generatedAt": db.now(), "seasons": []}
    for s in seasons:
        matches = conn.execute("SELECT * FROM matches WHERE season_id = ? ORDER BY kickoff, id", (s["id"],)).fetchall()
        if args.season not in ("all", s["name"], str(s["id"])) and not (args.season == "current" and s["is_current"]):
            matches = []
        if not matches:
            kept = previous.get(slugify(s["name"]))
            if kept and (out / "seasons" / f"{kept['slug']}.json").exists():
                index["seasons"].append({**kept, "isCurrent": bool(s["is_current"])})
            continue
        teams = conn.execute("SELECT * FROM teams WHERE season_id = ?", (s["id"],)).fetchall()
        with_games = {m["home_id"] for m in matches} | {m["away_id"] for m in matches}
        divisions: dict[str, dict] = {}
        for p in conn.execute("SELECT * FROM pools WHERE season_id = ? ORDER BY sort", (s["id"],)):
            ids = [t["id"] for t in teams if t["pool_title"] == p["title"]]
            if p["division"] in NOT_DIVISIONS or not any(i in with_games for i in ids):
                continue
            name = DISPLAY_NAMES.get(p["division"], p["division"])
            d = divisions.setdefault(name, {"slug": slugify(name), "name": name, "teampassName": p["division"], "pools": [],
                                            "_order": division_order(name, p["sort"])})
            d["pools"].append({"name": p["name"], "teamIds": ids})
        ordered = sorted(divisions.values(), key=lambda d: d.pop("_order"))
        keep = {i for d in ordered for p in d["pools"] for i in p["teamIds"]}
        data = {
            "season": {"id": s["id"], "name": s["name"], "slug": slugify(s["name"]), "isCurrent": bool(s["is_current"])},
            "divisions": ordered,
            "teams": [{"id": t["id"], "name": t["name"], "colours": t["colours"]} for t in teams if t["id"] in keep],
            "matches": [{
                "id": m["id"], "kickoff": m["kickoff"], "venue": m["venue"], "pitch": m["pitch"], "type": m["match_type"],
                "home": m["home_id"], "away": m["away_id"], "homeName": m["home_name"], "awayName": m["away_name"],
                "hs": m["home_score"], "as": m["away_score"], "status": m["status"], "forfeit": bool(m["forfeit"]),
            } for m in matches if m["home_id"] in keep or m["away_id"] in keep],
        }
        (out / "seasons" / f"{data['season']['slug']}.json").write_text(json.dumps(data, separators=(",", ":")))
        index["seasons"].append({**data["season"], "divisions": [{"slug": d["slug"], "name": d["name"]} for d in data["divisions"]]})
        print(f"{s['name']}: {len(data['divisions'])} divisions, {len(data['teams'])} teams, {len(data['matches'])} matches")
    (out / "index.json").write_text(json.dumps(index, indent=1))
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="tasl-scraper")
    ap.add_argument("--db", default=str(REPO / "data" / "tasl.db"))
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("scrape", help="Fetch seasons, tables and every team's matches")
    s.add_argument("--season", default="current", help="'current', 'all', a season id, or a name like 'Fall 2025'")
    s.add_argument("--delay", type=float, default=1.0, help="Seconds between requests")
    s.add_argument("--raw", default=None, help="Directory to keep raw HTML for debugging")
    s.set_defaults(fn=scrape)
    v = sub.add_parser("verify", help="Compare computed tables with TeamPass's official tables")
    v.add_argument("--season", default="current")
    v.set_defaults(fn=verify)
    e = sub.add_parser("export", help="Write JSON for the web app")
    e.add_argument("--out", default=str(REPO / "web" / "data"))
    e.add_argument("--season", default="all", help="Seasons to re-export; others keep their existing files")
    e.set_defaults(fn=export)
    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
