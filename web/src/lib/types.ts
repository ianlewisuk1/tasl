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
  // TeamPass guest-player ("sub") signup for each team, present for upcoming games.
  homeSub?: string | null;
  awaySub?: string | null;
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
  clubs: { [teamId: number]: string }; // team id -> club page slug
  hasHistory: boolean;
  teams: Team[];
  matches: GwMatch[]; // matches involving this division's teams, with a gameweek number
  gameweeks: number; // total gameweeks in the schedule
  seasons: { slug: string; name: string; hasDivision: boolean }[];
  divisions: { slug: string; name: string }[];
  generatedAt: string;
};

/** Played, won, drawn, lost, goals for and against, points. */
export type Tally = { p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number };

export type ClubSeason = Tally & {
  season: string; seasonName: string; division: string; divisionName: string; pool: string | null;
  tier: number | null; teamId: number; pos: number; of: number; champion: boolean;
};

export type Club = {
  slug: string; name: string; family: string; familyLabel: string; colours: string | null; teamId: number;
  otherNames: string[]; titles: number; totals: Tally; seasons: ClubSeason[];
  headToHead: (Omit<Tally, "pts"> & { club: string; name: string })[];
};

export type Honour = { club: string; name: string; pts: number };
export type DivisionHistory = {
  slug: string; name: string;
  seasons: { season: string; seasonName: string; winners: { pool: string | null; champion: Honour; runnerUp: Honour | null }[] }[];
  allTime: (Tally & { club: string; name: string; seasons: number; titles: number })[];
};
