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


def test_three_way_tie_where_all_have_met_uses_head_to_head():
    # Each team beats one other once, so head-to-head is level (3 each) and capped GD decides.
    results = [Result(1, 2, 1, 0), Result(2, 3, 5, 0), Result(3, 1, 1, 0)]
    table = compute([1, 2, 3], results)
    assert [(r.team_id, r.h2h, r.gd3) for r in table] == [(2, 3, 2), (1, 3, 0), (3, 3, -2)]


def test_capped_gd_and_shutouts():
    table = compute([1, 2], [Result(1, 2, 7, 0), Result(2, 1, 0, 0)])
    one = next(r for r in table if r.team_id == 1)
    assert one.gd == 7 and one.gd3 == 3 and one.shutouts == 2 and one.form == ["W", "D"]


def test_head_to_head_skipped_when_tied_teams_have_not_all_met():
    # 1, 2 and 3 all finish on 3 pts, but 1 and 3 never played each other, so TeamPass skips head-to-head:
    # 3 has the best capped GD and ranks first even though it lost to 2.
    results = [Result(1, 2, 1, 0), Result(2, 3, 1, 0), Result(3, 4, 9, 0)]
    table = compute([1, 2, 3, 4], results)
    assert [(r.team_id, r.pts, r.gd3) for r in table] == [(3, 3, 2), (1, 3, 1), (2, 3, 0), (4, 0, -3)]


def test_teams_without_games_go_last():
    table = compute([1, 2, 3], [Result(1, 2, 9, 0)])
    assert [r.team_id for r in table] == [1, 2, 3]
