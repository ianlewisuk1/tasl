"""Prototype data builder: parse saved TeamPass team pages for one division into matches JSON.

Usage: python3 scripts/build_prototype_data.py RAW_DIR OUT_JSON
RAW_DIR holds team_<id>.html files (public pages, no login).
"""
import datetime as dt
import html
import json
import pathlib
import re
import sys

SEASON_YEAR = 2026
ROW = re.compile(r"<tr class=TableRow\d>(.*?)</tr>", re.S)
TD = re.compile(r"<td[^>]*>(.*?)</td>", re.S)


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def parse_team(path):
    s = path.read_text(errors="ignore")
    team_id = int(re.search(r"team_(\d+)", path.name).group(1))
    bar = re.search(r"\.Club_Bar\{\s*background-color:(#[0-9a-fA-F]{3,6})", s)
    colour_name = re.search(r"Team Colors - ([^|<]+)", s)
    name = clean(re.search(r'<h1>\s*<A href="/League/TASL/Team/\d+">(.*?)</a>', s, re.S).group(1))
    sched = s[s.find("Match Schedule"):]
    sched = sched[: sched.find("</table>")]
    matches = []
    for row in ROW.findall(sched):
        cells = TD.findall(row)
        if len(cells) < 4:
            continue
        when = clean(cells[0])  # "Saturday, Aug 15 - 2:00 PM"
        d = dt.datetime.strptime(f"{when.split(', ', 1)[1]} {SEASON_YEAR}", "%b %d - %I:%M %p %Y")
        venue, _, pitch = clean(cells[1]).partition(" - ")
        opp = re.search(r'/League/TASL/Team/(\d+)">\s*<span[^>]*>(vs|@)</span>\s*([^<]+)', cells[2])
        kind = clean(re.search(r"<b>(.*?)</b>", cells[2]).group(1))
        res = re.search(r"(Win|Loss|Draw)\s*\((\d+):(\d+)\)", clean(cells[3]))
        event = re.search(r"/Event/(\d+)_", cells[3])
        forfeit = "Forfeit" in row
        is_home = opp.group(2) == "vs"
        opp_id = int(opp.group(1))
        m = {
            "id": int(event.group(1)) if event else None,
            "kickoff": d.isoformat(timespec="minutes"),
            "venue": venue.title(),
            "pitch": pitch.title(),
            "type": kind,
            "home": team_id if is_home else opp_id,
            "away": opp_id if is_home else team_id,
            "hs": int(res.group(2)) if res else None,
            "as": int(res.group(3)) if res else None,
            "forfeit": forfeit,
        }
        matches.append(m)
    return {
        "id": team_id,
        "name": name,
        "colour": bar.group(1) if bar else None,
        "colourName": colour_name.group(1).strip() if colour_name else None,
    }, matches


def main(raw_dir, out_json):
    teams, matches = [], {}
    for p in sorted(pathlib.Path(raw_dir).glob("team_*.html")):
        t, ms = parse_team(p)
        teams.append(t)
        for m in ms:
            matches[m["id"] or f'{m["kickoff"]}-{m["home"]}-{m["away"]}'] = m
    data = {
        "season": "Fall 2026",
        "division": "Mens 2",
        "scrapedAt": dt.datetime.now().isoformat(timespec="minutes"),
        "teams": teams,
        "matches": sorted(matches.values(), key=lambda m: m["kickoff"]),
    }
    pathlib.Path(out_json).write_text(json.dumps(data, indent=1))
    print(f"{len(teams)} teams, {len(data['matches'])} matches")


if __name__ == "__main__":
    main(*sys.argv[1:3])
