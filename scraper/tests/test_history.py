from tasl_scraper.cli import DIVISION_ORDER, slugify
from tasl_scraper.history import build, family, normalise


def test_normalise_and_family():
    assert normalise("Dang’s Young Boys") == normalise("Dangs Young Boys FC") == "dangs young boys"
    assert family("Men's Over 30 Championship") == "mens-o30"
    assert family("Men's League One") == "mens"
    assert family("Coed National League North") == "coed"
    assert family("Coed Over 30 Premier League") == "coed-o30"
    assert family("Women's Super League") == "womens"


def row(team_id, name, pos, pts, p=2):
    return {"team_id": team_id, "team_name": name, "pos": pos, "p": p, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "pts": pts}


def test_clubs_link_across_seasons_and_split_by_family():
    seasons = [
        {"slug": "fall-2025", "name": "Fall 2025", "matches": [{"home": 1, "away": 2, "hs": 2, "as": 0}], "divisions": [
            {"slug": "mens-championship", "name": "Men's Championship", "pools": [{"name": None, "rows": [row(1, "Storm", 1, 6), row(2, "Owls FC", 2, 0)]}]},
            {"slug": "womens-super-league", "name": "Women's Super League", "pools": [{"name": None, "rows": [row(3, "Storm", 1, 3)]}]},
        ]},
        {"slug": "fall-2026", "name": "Fall 2026", "matches": [{"home": 12, "away": 11, "hs": 1, "as": 1}], "divisions": [
            {"slug": "mens-premier-league", "name": "Men's Premier League", "pools": [{"name": None, "rows": [row(11, "Storm FC", 2, 1), row(12, "Owls", 1, 1)]}]},
        ]},
    ]
    clubs, divisions = build(seasons, DIVISION_ORDER, slugify)
    by = {(c["name"], c["family"]): c for c in clubs}
    storm = by[("Storm FC", "mens")]
    assert [s["division"] for s in storm["seasons"]] == ["mens-championship", "mens-premier-league"]
    assert storm["titles"] == 1 and storm["slug"] == "storm-fc"
    assert ("Storm", "womens") in by  # same name, different family: a different club
    owls = next(o for o in storm["headToHead"] if o["name"] == "Owls")
    assert (owls["p"], owls["w"], owls["d"]) == (2, 1, 1)
    champs = next(d for d in divisions if d["slug"] == "mens-championship")["seasons"][0]["winners"][0]
    assert champs["champion"]["club"] == "storm-fc"
