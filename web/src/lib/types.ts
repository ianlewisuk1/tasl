import type { GwMatch } from "./table";

export type SeasonRef = { id: number; name: string; slug: string; isCurrent: boolean };

export type Index = {
  generatedAt: string;
  seasons: (SeasonRef & { divisions: { slug: string; name: string }[] })[];
};

export type Team = { id: number; name: string; colours: string | null };

export type Match = {
  id: string;
  kickoff: string; // local ISO, e.g. "2026-08-15T14:00"
  venue: string | null;
  pitch: string | null;
  type: string;
  home: number | null;
  away: number | null;
  homeName: string;
  awayName: string;
  hs: number | null;
  as: number | null;
  status: string; // "played" | "scheduled" | TeamPass text
  forfeit: boolean;
};

export type Pool = { name: string | null; teamIds: number[] };
export type Division = { slug: string; name: string; teampassName: string; pools: Pool[] };

export type SeasonData = {
  season: SeasonRef;
  divisions: Division[];
  teams: Team[];
  matches: Match[];
};

/** Everything one division page needs; built on the server, passed to the client view. */
export type DivisionView = {
  season: SeasonRef;
  division: Division;
  teams: Team[];
  matches: GwMatch[]; // matches involving this division's teams, with a gameweek number
  gameweeks: number; // total gameweeks in the schedule
  seasons: { slug: string; name: string; hasDivision: boolean }[];
  divisions: { slug: string; name: string }[];
  generatedAt: string;
};
