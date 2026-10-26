"""Compute league tables from match results using the TASL point system.

Win 3, draw 1, loss 0. Ties broken by: head-to-head points among the tied teams, goal difference
capped at 3 per game, fewest goals against, most shutouts (win or draw with nothing conceded).
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class Result:
    home_id: int
    away_id: int
    home_score: int
    away_score: int


@dataclass
class Row:
    team_id: int
    p: int = 0
    w: int = 0
    d: int = 0
    l: int = 0
    gf: int = 0
    ga: int = 0
    gd3: int = 0
    pts: int = 0
    shutouts: int = 0
    h2h: int = 0
    pos: int = 0
    form: list[str] = field(default_factory=list)

    @property
    def gd(self) -> int:
        return self.gf - self.ga


def compute(team_ids: list[int], results: list[Result]) -> list[Row]:
    """`results` must be in kickoff order (form is taken from it). Matches with outsiders are ignored."""
    ids = set(team_ids)
    rows = {t: Row(t) for t in team_ids}
    league = [r for r in results if r.home_id in ids and r.away_id in ids]
    for m in league:
        for me, f, a in ((m.home_id, m.home_score, m.away_score), (m.away_id, m.away_score, m.home_score)):
            r = rows[me]
            r.p += 1
            r.gf += f
            r.ga += a
            r.gd3 += max(-3, min(3, f - a))
            if f > a:
                r.w += 1
                r.pts += 3
                r.form.append("W")
            elif f < a:
                r.l += 1
                r.form.append("L")
            else:
                r.d += 1
                r.pts += 1
                r.form.append("D")
            if a == 0 and f >= a:
                r.shutouts += 1

    by_pts = defaultdict(list)
    for r in rows.values():
        by_pts[r.pts].append(r)
    for group in by_pts.values():
        if len(group) < 2:
            continue
        tied = {r.team_id for r in group}
        for m in league:
            if m.home_id in tied and m.away_id in tied:
                if m.home_score > m.away_score:
                    rows[m.home_id].h2h += 3
                elif m.home_score < m.away_score:
                    rows[m.away_id].h2h += 3
                else:
                    rows[m.home_id].h2h += 1
                    rows[m.away_id].h2h += 1

    table = sorted(rows.values(), key=lambda r: (-r.pts, -r.h2h, -r.gd3, r.ga, -r.shutouts))
    for i, r in enumerate(table, 1):
        r.pos = i
    return table
