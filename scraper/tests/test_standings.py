import json
import pathlib

from tasl_scraper.standings import Result, compute

PROTO = pathlib.Path(__file__).resolve().parents[2] / "prototype" / "mens2.json"


def test_mens2_matches_official_order():
    data = json.loads(PROTO.read_text())
    results = [Result(m["home"], m["away"], m["hs"], m["as"]) for m in data["matches"] if m["hs"] is not None]
    table = compute([t["id"] for t in data["teams"]], results)
    names = {t["id"]: t["name"] for t in data["teams"]}
    assert [(names[r.team_id], r.p, r.pts) for r in table] == [
        ("The Benchwarmers", 9, 16), ("Broke Down FC", 9, 16), ("Womble Park Rangers", 8, 15), ("Storm", 9, 14),
        ("Capital Pride Young Boys", 9, 11), ("Hangover Heroes", 8, 11), ("Medicine City FC", 8, 10), ("Owls FC", 8, 4),
    ]
    bench = table[0]
    assert (bench.gf, bench.ga, bench.gd3) == (22, 12, 7)


def test_head_to_head_beats_goal_difference():
    # A (1) and B (2) both finish on 4 pts. B has the better capped GD but lost to A, so A ranks first.
    results = [Result(1, 2, 1, 0), Result(1, 3, 1, 1), Result(2, 4, 6, 0), Result(2, 3, 0, 0)]
    table = compute([1, 2, 3, 4], results)
    a, b = table[0], table[1]
    assert (a.team_id, a.pts, a.gd3) == (1, 4, 1)
    assert (b.team_id, b.pts, b.gd3) == (2, 4, 2)


def test_three_way_tie_falls_to_capped_gd():
    # Each team wins once against the others, so head-to-head is level and capped GD decides.
    results = [Result(1, 2, 1, 0), Result(2, 3, 5, 0), Result(3, 1, 1, 0)]
    table = compute([1, 2, 3], results)
    assert [(r.team_id, r.gd3) for r in table] == [(2, 2), (1, 0), (3, -2)]


def test_capped_gd_and_shutouts():
    table = compute([1, 2], [Result(1, 2, 7, 0), Result(2, 1, 0, 0)])
    one = next(r for r in table if r.team_id == 1)
    assert one.gd == 7 and one.gd3 == 3 and one.shutouts == 2 and one.form == ["W", "D"]
