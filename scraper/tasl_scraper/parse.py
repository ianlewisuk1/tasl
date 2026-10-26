"""Parsers for TeamPass league pages. Pure functions: HTML string in, dataclasses out."""
from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass, field

from selectolax.lexbor import LexborHTMLParser as HTMLParser, LexborNode as Node

TEAM_HREF = re.compile(r"/Team/(\d+)")
EVENT_HREF = re.compile(r"/Event/(\d+)_")
WEEKDAY = re.compile(r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*(\w{3})\w*\s+(\d{1,2})\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)")
RESULT = re.compile(r"\b(Win|Loss|Draw)\s*\((\d+):(\d+)\)")
TEAM_COUNT = re.compile(r"\s*\(\d+ Teams?\)\s*$")


def _text(node: Node | None) -> str:
    return re.sub(r"\s+", " ", node.text(separator=" ")).strip() if node else ""


def _int(s: str) -> int:
    s = s.strip()
    return int(s) if re.fullmatch(r"-?\d+", s) else 0


# ---------- standings page ----------

@dataclass
class Season:
    id: int
    name: str
    selected: bool = False

    @property
    def term(self) -> str:
        return self.name.rsplit(" ", 1)[0]

    @property
    def year(self) -> int:
        return int(self.name.rsplit(" ", 1)[1])


@dataclass
class Division:
    id: int
    name: str


@dataclass
class StandingRow:
    rank: int
    team_id: int
    team_name: str
    mp: int
    w: int
    d: int
    l: int
    gf: int
    ga: int
    gd3: int
    pts: int


@dataclass
class Pool:
    """One standings table. A division can have several (e.g. 'Rec A', 'Rec B')."""
    title: str          # full heading, e.g. "Fall 2026 - Women's 8v8 Recreation - Women's 8v8 Rec A"
    division: str       # e.g. "Women's 8v8 Recreation"
    name: str | None    # e.g. "Women's 8v8 Rec A"; None when the division has one table
    rows: list[StandingRow] = field(default_factory=list)


@dataclass
class StandingsPage:
    seasons: list[Season]
    divisions: list[Division]
    pools: list[Pool]
    form_hash: str | None

    @property
    def current_season(self) -> Season | None:
        """None when TeamPass has no table for the season (it shows "Coming Soon!!!" instead)."""
        return next((s for s in self.seasons if s.selected), self.seasons[-1] if self.seasons else None)


def parse_standings(html: str) -> StandingsPage:
    tree = HTMLParser(html)
    seasons = [
        Season(int(o.attributes["value"]), _text(o), "selected" in o.attributes)
        for o in tree.css("select[name=Table_Season] option")
        if (o.attributes.get("value") or "").isdigit()
    ]
    divisions = []
    for o in tree.css("select[name=DivsAndSkillsFilter] option"):
        val = (o.attributes.get("value") or "").split(",")[0]
        if val.isdigit():
            divisions.append(Division(int(val), TEAM_COUNT.sub("", _text(o))))
    hash_input = tree.css_first("input[name=hash]")
    season_name = next((s.name for s in seasons if s.selected), None)

    pools = []
    for title_node in tree.css("div.leagueAccordTitle"):
        title = _text(title_node.css_first(".leagueAccordTitle1") or title_node)
        box = title_node.next
        while box is not None and "leagueAccordbox" not in (box.attributes.get("class") or ""):
            box = box.next
        if box is None:
            continue
        division, name = _split_title(title, season_name, [d.name for d in divisions])
        pool = Pool(title=title, division=division, name=name)
        for tr in box.css("table tr"):
            tds = tr.css("td")
            link = tr.css_first("a[href*='/Team/']")
            if len(tds) < 10 or link is None:
                continue
            nums = [_int(_text(td)) for td in tds]
            pool.rows.append(StandingRow(
                rank=nums[0],
                team_id=int(TEAM_HREF.search(link.attributes["href"]).group(1)),
                team_name=_text(link),
                mp=nums[2], w=nums[3], d=nums[4], l=nums[5], gf=nums[6], ga=nums[7], gd3=nums[8], pts=nums[9],
            ))
        pools.append(pool)
    return StandingsPage(seasons, divisions, pools, hash_input.attributes.get("value") if hash_input else None)


def _split_title(title: str, season_name: str | None, division_names: list[str]) -> tuple[str, str | None]:
    rest = title
    if season_name and rest.startswith(season_name + " - "):
        rest = rest[len(season_name) + 3:]
    else:
        rest = rest.split(" - ", 1)[-1]
    # Division names can contain " - " (e.g. "Men Over 30 - 1"), so match the longest known name first.
    for name in sorted(division_names, key=len, reverse=True):
        if rest == name:
            return name, None
        if rest.startswith(name + " - "):
            pool = rest[len(name) + 3:].strip()
            return name, None if pool == "TASL" else pool
    division, _, pool = rest.partition(" - ")
    return division, (pool or None) if pool != "TASL" else None


# ---------- team page ----------

@dataclass
class Match:
    event_id: int | None
    kickoff: dt.datetime
    venue: str
    pitch: str
    match_type: str
    home_id: int | None
    away_id: int | None
    home_name: str
    away_name: str
    home_score: int | None
    away_score: int | None
    status: str          # "played", "scheduled", or raw text such as "Cancelled"
    forfeit: bool

    @property
    def key(self) -> str:
        if self.event_id:
            return str(self.event_id)
        return f"x-{self.kickoff:%Y%m%d%H%M}-{self.home_id or self.home_name}-{self.away_id or self.away_name}"


@dataclass
class TeamPage:
    id: int
    name: str
    division: str
    season_name: str
    colours: str | None
    matches: list[Match]


def parse_team(html: str, team_id: int, season_year: int) -> TeamPage:
    tree = HTMLParser(html)
    h1 = tree.css_first(".Club_Bar h1")
    name = _text(h1.css_first("a")) if h1 else ""
    small = " ".join(_text(s) for s in h1.css("small")) if h1 else ""
    parts = [p.strip() for p in small.split("|") if p.strip()]
    colours = next((p.split("-", 1)[1].strip() for p in parts if p.startswith("Team Colors")), None)
    parts = [p for p in parts if not p.startswith("Team Colors")]
    division = parts[0] if parts else ""
    season_name = parts[-1] if len(parts) > 1 else ""

    matches = []
    table = _table_after_heading(tree, "Match Schedule")
    for tr in table.css("tr") if table else []:
        tds = tr.css("td")
        if len(tds) < 4:
            continue
        m = _parse_match_row(tds, team_id, name, season_year)
        if m:
            matches.append(m)
    return TeamPage(team_id, name, division, season_name, colours, matches)


def _table_after_heading(tree: HTMLParser, heading: str) -> Node | None:
    for h2 in tree.css("h2"):
        if _text(h2) == heading:
            node = h2.next
            while node is not None:
                if node.tag == "table":
                    return node
                if node.tag == "h2":
                    return None
                node = node.next
    return None


def _parse_match_row(tds: list[Node], team_id: int, team_name: str, season_year: int) -> Match | None:
    when = _text(tds[0])  # "Saturday, Aug 15 - 2:00 PM", sometimes prefixed: "Cancelled Wednesday, Jul 19 - 6:15 PM"
    kickoff = parse_kickoff(when, season_year)
    if kickoff is None:
        return None
    prefix = when[: WEEKDAY.search(when).start()].strip()
    venue, _, pitch = _text(tds[1]).partition(" - ")

    cell = tds[2]
    kind = _text(cell.css_first("b")) or "Regular Season"
    link = cell.css_first("a[href*='/Team/']")
    if link is not None:
        opp_id = int(TEAM_HREF.search(link.attributes["href"]).group(1))
        link_text = _text(link)
        is_home = not link_text.startswith("@")
        opp_name = re.sub(r"^(vs|@)\s+", "", link_text)
    else:
        txt = _text(cell).split(":", 1)[-1].strip()
        is_home = not txt.startswith("@")
        opp_id, opp_name = None, re.sub(r"^(vs|@)\s+", "", re.sub(r"\(\d+-\d+-\d+\)$", "", txt)).strip()

    result_cell = tds[3]
    res_text = _text(result_cell).replace("(view)", "").strip()
    res = RESULT.search(res_text)
    event = result_cell.css_first("a[href*='/Event/']")
    event_id = int(EVENT_HREF.search(event.attributes["href"]).group(1)) if event else None
    row_text = " ".join(_text(td) for td in tds)
    forfeit = "forfeit" in row_text.lower()
    if res:
        status = "played"
        # A cancelled match that still shows a result was awarded; TeamPass counts it like a forfeit.
        forfeit = forfeit or bool(prefix)
    elif prefix or res_text:
        status = prefix or res_text
    else:
        status = "scheduled"

    home_id, away_id = (team_id, opp_id) if is_home else (opp_id, team_id)
    home_name, away_name = (team_name, opp_name) if is_home else (opp_name, team_name)
    return Match(
        event_id=event_id,
        kickoff=kickoff,
        venue=venue.title(),
        pitch=pitch.title(),
        match_type=kind,
        home_id=home_id,
        away_id=away_id,
        home_name=home_name,
        away_name=away_name,
        # TeamPass prints scores as home:away regardless of whose page it is.
        home_score=int(res.group(2)) if res else None,
        away_score=int(res.group(3)) if res else None,
        status=status,
        forfeit=forfeit,
    )


def parse_kickoff(when: str, season_year: int) -> dt.datetime | None:
    """'Saturday, Aug 15 - 2:00 PM' has no year. Pick the year near the season whose weekday matches."""
    m = WEEKDAY.search(when)
    if not m:
        return None
    weekday, mon, day, time = m.groups()
    for year in (season_year, season_year + 1, season_year - 1):
        try:
            d = dt.datetime.strptime(f"{mon} {day} {year} {time.replace(' ', '')}", "%b %d %Y %I:%M%p")
        except ValueError:
            continue
        if d.strftime("%A") == weekday:
            return d
    return dt.datetime.strptime(f"{mon} {day} {season_year} {time.replace(' ', '')}", "%b %d %Y %I:%M%p")
