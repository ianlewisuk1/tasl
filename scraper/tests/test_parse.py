import datetime as dt
import pathlib

from tasl_scraper.parse import parse_kickoff, parse_standings, parse_team

FIX = pathlib.Path(__file__).parent / "fixtures"


def read(name):
    return (FIX / name).read_text(encoding="utf-8", errors="ignore")


def test_standings_lists_seasons_divisions_and_hash():
    page = parse_standings(read("standings_fall2026.html"))
    assert [s.name for s in page.seasons][:2] == ["Fall 2021", "Spring 2023"]
    assert page.current_season.name == "Fall 2026"
    assert page.current_season.id == 10547
    assert any(d.name == "Coed Cup" and d.id == 15380 for d in page.divisions)
    assert page.form_hash


def test_standings_pools_and_rows():
    page = parse_standings(read("standings_fall2026.html"))
    by_title = {p.title: p for p in page.pools}
    mens2 = by_title["Fall 2026 - Mens 2 - TASL"]
    assert mens2.division == "Mens 2" and mens2.name is None
    top = mens2.rows[0]
    assert (top.team_name, top.mp, top.w, top.d, top.l, top.gf, top.ga, top.gd3, top.pts) == (
        "The Benchwarmers", 9, 5, 1, 3, 22, 12, 7, 16)
    rec_a = by_title["Fall 2026 - Women's 8v8 Recreation - Women's 8v8 Rec A"]
    assert rec_a.division == "Women's 8v8 Recreation" and rec_a.name == "Women's 8v8 Rec A"
    o30 = next(p for p in page.pools if p.division == "Men Over 30 - 1")
    assert o30.name is None
    assert sum(len(p.rows) for p in page.pools) > 150


def test_past_season_standings():
    page = parse_standings(read("standings_fall2025.html"))
    assert page.current_season.name == "Fall 2025"
    assert any(p.division == "Mens 1" for p in page.pools)


def test_team_page_matches():
    team = parse_team(read("team_161744.html"), 161744, 2026)
    assert team.name == "Broke Down FC"
    assert team.division == "Mens 2" and team.season_name == "Fall 2026"
    first = team.matches[0]
    assert first.kickoff == dt.datetime(2026, 8, 15, 14, 0)
    assert (first.home_id, first.away_id, first.home_score, first.away_score) == (161744, 161861, 3, 2)
    assert first.event_id == 318382 and first.status == "played"
    away = team.matches[1]  # "@ Storm  Win (1:2)" -> Storm at home, scored 1
    assert (away.home_id, away.away_id, away.home_score, away.away_score) == (161854, 161744, 1, 2)
    assert first.venue == "Wake Stone Athletic Park" and first.pitch == "Wake Stone 3"


def test_team_page_forfeit_and_colours():
    team = parse_team(read("team_161724.html"), 161724, 2026)
    assert any(m.forfeit for m in team.matches)
    capital = parse_team(read("team_113852_fall2025.html"), 113852, 2025)
    assert capital.colours == "Sky Blue"
    assert capital.season_name == "Fall 2025"


def test_kickoff_year_from_weekday():
    assert parse_kickoff("Saturday, Aug 15 - 2:00 PM", 2026) == dt.datetime(2026, 8, 15, 14, 0)
    # Fall 2025 season, but a January game falls in 2026
    assert parse_kickoff("Saturday, Jan 10 - 9:00 AM", 2025).year == 2026


def test_season_without_standings():
    page = parse_standings("<html><body><div>Coming Soon!!!</div></body></html>")
    assert page.current_season is None and page.pools == []
