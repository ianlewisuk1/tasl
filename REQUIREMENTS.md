# TASL Hub — Requirements

## Goal
Replace the fragmented TASL web presence (tasl.us + app.teampass.com) with one fast, mobile-first site. Pitch to the league as a replacement.

## Data
- Source: public TeamPass pages + tasl.us. No login needed (login only unlocks the account's own rosters — PII, out of scope).
- Scheduled scrape (GitHub Actions cron). Backfill all seasons from Fall 2021.

## R1 — Standings styled like Premier League / top European leagues
Differentiator. Reference: https://www.premierleague.com/en/tables/premier-league/2026-27 — mimic it closely (dark purple, gradient title band, outlined filter dropdowns, row blocks with zone bars, chevron movement, small form circles, crest-only Next).

Columns: Pos, crest + team, P, W, D, L, GF, GA, GD, Pts, Form (last 5), Next.

- **Form guide**: last 5 results as W/D/L pills (green/grey/red), hover/tap shows score + opponent.
- **Next fixture**: opponent crest, date/time, field.
- **Position movement**: up/down arrow vs previous matchday.
- **Zone bands**: coloured left border for title / promotion / relegation spots (per-division config).
- **Crests**: TASL has no logos — generate monogram crests from team name + team colours (team page lists colours).
- **Expandable row** (mobile tap): full results, head-to-head, goals chart.
- **Tiebreakers** shown and applied per TASL point system: H2H, GD capped at 3/game (GD3), fewest GA, most shutouts. Show real GD; GD3 in tooltip/column toggle.
- **Filters (dropdowns)**: Division, Season, Gameweek, Home & Away, Reset.
- **Gameweeks**: label rounds 'Gameweek N' (GW = each Mon–Sun week with scheduled matches), never dates.
- Sticky header, condensed mobile view (Pos, team, P, GD, Pts, Form).

Data implications:
- Form, next fixture, movement: derived from match-level results, not the standings table. Need per-matchday standings recompute.
- Team colours: scrape from team page header.
