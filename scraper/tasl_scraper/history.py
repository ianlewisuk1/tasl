"""Cross-season history: link each season's teams into clubs, and summarise divisions over time.

TeamPass gives a team a new id every season, so a club is identified by its normalised name within a
family of divisions (men's open, each men's age group, coed, coed over 30, women's). The family matters:
"Capital Pride" fields different teams in Women's Super League and Men's Over 30 in the same season.
"""
from __future__ import annotations

import json
import pathlib
import re
from collections import defaultdict

ALIASES_FILE = pathlib.Path(__file__).with_name("club_aliases.json")
DROP_WORDS = {"the", "fc", "sc", "afc", "cf"}


def normalise(name: str) -> str:
    s = name.lower().replace("’", "'").replace("'", "")
    words = [w for w in re.split(r"[^a-z0-9]+", s) if w and w not in DROP_WORDS]
    return " ".join(words)


def family(division: str) -> str:
    """'Men's Over 30 Championship' -> 'mens-o30'; 'Coed League One' -> 'coed'; "Women's Super League" -> 'womens'."""
    m = re.match(r"(Men's|Mens|Men|Coed|Co-ed|Women's|Womens)\b(?:'s)?(?:.*?Over (\d+))?", division)
    if not m:
        return "other"
    base = {"men": "mens", "mens": "mens", "men's": "mens", "coed": "coed", "co-ed": "coed"}.get(m.group(1).lower(), "womens")
    return f"{base}-o{m.group(2)}" if m.group(2) else base


FAMILY_LABEL = {"mens": "Men's", "coed": "Coed", "womens": "Women's"}


def family_label(fam: str) -> str:
    if fam in FAMILY_LABEL:
        return FAMILY_LABEL[fam]
    base, _, age = fam.partition("-o")
    return f"{FAMILY_LABEL.get(base, base.title())} Over {age}"


def load_aliases() -> dict[str, str]:
    """Optional manual merges: {"old normalised name": "current normalised name"}."""
    if ALIASES_FILE.exists():
        return {normalise(k): normalise(v) for k, v in json.loads(ALIASES_FILE.read_text()).items()}
    return {}


def build(seasons: list[dict], division_order: list[str], slugify) -> tuple[list[dict], list[dict]]:
    """
    `seasons`: oldest first, each {"slug", "name", "divisions": [{"slug", "name", "pools": [{"rows": [...]}]}],
    "matches": [...]} where pool rows are final standings {"team_id", "team_name", "pos", "p", "w", "d", "l",
    "gf", "ga", "pts"} and matches are played regular-season results with home/away team ids.
    Returns (clubs, division_histories).
    """
    aliases = load_aliases()
    clubs: dict[tuple[str, str], dict] = {}
    team_club: dict[int, tuple[str, str]] = {}

    for season in seasons:
        for div in season["divisions"]:
            fam = family(div["name"])
            tier = division_order.index(div["name"]) if div["name"] in division_order else None
            for pool in div["pools"]:
                size = len(pool["rows"])
                for row in pool["rows"]:
                    norm = normalise(row["team_name"])
                    key = (fam, aliases.get(norm, norm))
                    club = clubs.setdefault(key, {"family": fam, "names": [], "seasons": [], "colours": None})
                    club["names"].append(row["team_name"])
                    club["colours"] = row.get("colours") or club["colours"]
                    club["teamId"] = row["team_id"]
                    team_club[row["team_id"]] = key
                    club["seasons"].append({
                        "season": season["slug"], "seasonName": season["name"],
                        "division": div["slug"], "divisionName": div["name"],
                        "pool": pool.get("name") if len(div["pools"]) > 1 else None,
                        "tier": tier, "teamId": row["team_id"], "pos": row["pos"], "of": size,
                        **{k: row[k] for k in ("p", "w", "d", "l", "gf", "ga", "pts")},
                        "champion": row["pos"] == 1 and row["p"] > 0,
                    })

    # Head-to-head between clubs across every season.
    h2h: dict[tuple, dict] = defaultdict(lambda: {"p": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0})
    for season in seasons:
        for m in season["matches"]:
            a, b = team_club.get(m["home"]), team_club.get(m["away"])
            if not a or not b or a == b:
                continue
            for me, op, f, g in ((a, b, m["hs"], m["as"]), (b, a, m["as"], m["hs"])):
                r = h2h[(me, op)]
                r["p"] += 1
                r["gf"] += f
                r["ga"] += g
                r["w" if f > g else "l" if f < g else "d"] += 1

    # Slugs: name of the most recent season, plus the family when a name exists in several families.
    by_name = defaultdict(list)
    for key, c in clubs.items():
        c["name"] = c["names"][-1]
        by_name[slugify(c["name"])].append(key)
    for base, keys in by_name.items():
        for key in keys:
            clubs[key]["slug"] = base if len(keys) == 1 else f"{base}-{key[0]}"

    out = []
    for key, c in clubs.items():
        seasons_played = [s for s in c["seasons"] if s["p"] > 0]
        tot = {k: sum(s[k] for s in seasons_played) for k in ("p", "w", "d", "l", "gf", "ga", "pts")}
        opponents = sorted(
            ({"club": clubs[op]["slug"], "name": clubs[op]["name"], **r} for (me, op), r in h2h.items() if me == key),
            key=lambda r: (-r["p"], r["name"]),
        )
        out.append({
            "slug": c["slug"], "name": c["name"], "family": c["family"], "familyLabel": family_label(c["family"]),
            "colours": c["colours"], "teamId": c["teamId"],
            "otherNames": sorted(set(c["names"]) - {c["name"]}),
            "titles": sum(s["champion"] for s in c["seasons"]),
            "totals": tot, "seasons": c["seasons"], "headToHead": opponents,
        })
    out.sort(key=lambda c: c["name"].lower())

    divisions: dict[str, dict] = {}
    slug_of = {key: c["slug"] for key, c in clubs.items()}
    for season in seasons:
        for div in season["divisions"]:
            d = divisions.setdefault(div["slug"], {"slug": div["slug"], "name": div["name"], "seasons": [], "allTime": {}})
            winners = []
            for pool in div["pools"]:
                rows = [r for r in pool["rows"] if r["p"] > 0]
                if rows:
                    winners.append({
                        "pool": pool.get("name") if len(div["pools"]) > 1 else None,
                        "champion": {"club": slug_of[team_club[rows[0]["team_id"]]], "name": rows[0]["team_name"], "pts": rows[0]["pts"]},
                        "runnerUp": {"club": slug_of[team_club[rows[1]["team_id"]]], "name": rows[1]["team_name"], "pts": rows[1]["pts"]}
                        if len(rows) > 1 else None,
                    })
                for r in rows:
                    club = slug_of[team_club[r["team_id"]]]
                    at = d["allTime"].setdefault(club, {"club": club, "name": r["team_name"], "seasons": 0, "titles": 0,
                                                         "p": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "pts": 0})
                    at["name"] = r["team_name"]
                    at["seasons"] += 1
                    at["titles"] += r["pos"] == 1
                    for k in ("p", "w", "d", "l", "gf", "ga", "pts"):
                        at[k] += r[k]
            if winners:
                d["seasons"].append({"season": season["slug"], "seasonName": season["name"], "winners": winners})
    histories = []
    for d in divisions.values():
        table = sorted(d.pop("allTime").values(), key=lambda r: (-r["pts"], -(r["gf"] - r["ga"]), -r["gf"], r["name"]))
        d["seasons"].reverse()  # newest first
        histories.append({**d, "allTime": table})
    return out, histories
