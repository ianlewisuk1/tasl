"""Polite HTTP client for TeamPass public pages."""
from __future__ import annotations

import pathlib
import time

import httpx

from .parse import parse_standings

BASE = "https://app.teampass.com"
LEAGUE = f"{BASE}/League/TASL"
USER_AGENT = "tasl-hub/0.1 (+https://github.com/ianlewisuk1/tasl)"


class TeamPass:
    def __init__(self, delay: float = 1.0, raw_dir: pathlib.Path | None = None):
        self.delay = delay
        self.raw_dir = raw_dir
        self._last = 0.0
        self.http = httpx.Client(headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=30)

    def _wait(self):
        gap = time.monotonic() - self._last
        if gap < self.delay:
            time.sleep(self.delay - gap)
        self._last = time.monotonic()

    def _request(self, method: str, url: str, **kw) -> str:
        for attempt in range(3):
            self._wait()
            try:
                r = self.http.request(method, url, **kw)
                r.raise_for_status()
                return r.text
            except (httpx.TransportError, httpx.HTTPStatusError):
                if attempt == 2:
                    raise
                time.sleep(2 ** (attempt + 1))
        raise AssertionError("unreachable")

    def _save(self, name: str, html: str):
        if self.raw_dir:
            path = self.raw_dir / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(html)

    def standings(self, season_id: int | None = None) -> str:
        """Current season by GET; other seasons by POSTing the season filter form."""
        html = self._request("GET", f"{LEAGUE}/Standings/index.cfm")
        if season_id is not None:
            page = parse_standings(html)
            if page.current_season.id != season_id:
                html = self._request("POST", f"{LEAGUE}/Standings/index.cfm", data={
                    "Table_Season": str(season_id),
                    "DivsAndSkillsFilter": "",
                    "hash": page.form_hash or "",
                    "hash2": "",
                })
        self._save(f"standings/{season_id or 'current'}.html", html)
        return html

    def team(self, team_id: int) -> str:
        html = self._request("GET", f"{LEAGUE}/Team/{team_id}")
        self._save(f"teams/{team_id}.html", html)
        return html
