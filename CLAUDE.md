# TASL Hub

Replacement site for the Triangle Adult Soccer League. Product requirements: `REQUIREMENTS.md`. Visual spec: `prototype/standings.template.html` (Premier League table style).

## Layout
- `scraper/` — Python 3.12+, managed with `uv`. `tasl_scraper.parse` (pure HTML parsers), `client` (polite HTTP), `db` (SQLite now, portable SQL for Postgres later), `standings` (TASL table rules), `cli`.
- `web/` — Next.js site (not started).
- `data/` — local SQLite DB and raw HTML; gitignored.

## Commands
- Tests: `cd scraper && uv run pytest -q`
- Scrape current season: `cd scraper && uv run python -m tasl_scraper scrape --season current`
- Backfill: `... scrape --season all` (~1 request/second, takes a while)
- Check computed tables vs TeamPass: `... verify --season current`

## Data rules
- Public TeamPass pages only. Never log in from the scraper; logged-in pages expose rosters (personal data).
- Keep ≥1s between requests. Identify with the project User-Agent.
- TeamPass scores are always `home:away`, whichever team's page they appear on.
- Team ids are per season; the same club gets a new id each season.
- Table rules: W3 D1 L0; ties by head-to-head, GD capped ±3 per game, fewest GA, most shutouts. Only `Regular Season` matches count.
- Parser changes need a fixture-based test in `scraper/tests/` (fixtures are saved public pages).

## UI rules
- Mimic premierleague.com tables; rounds are "Gameweek N" (Mon–Sun week with scheduled games), never dates.
- Zones: champion = 1st (gold), relegation = bottom 2 (red).
- Every division uses English pyramid style names (Men's Premier League … Coed National League North lead the dropdown; then Men's Over 30 Premier League …, Coed Recreational League, Women's Super League, Women's Championship). Names and order: `DISPLAY_NAMES` / `DIVISION_ORDER` in `scraper/tasl_scraper/cli.py`. Old addresses redirect via `web/next.config.ts`.
