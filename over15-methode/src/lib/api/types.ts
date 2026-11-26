import type { Form } from '../types';

export interface TeamRef {
  id: string;
  name: string;
  logo?: string;
}

export interface Fixture {
  id: string;
  kickoff: string;
  status: string;
  leagueRef: string;
  leagueName: string;
  country: string;
  season: number | null;
  home: TeamRef;
  away: TeamRef;
}

/** Match terminé, format compact (pour le cache). */
export interface SeasonMatch {
  h: string;
  a: string;
  hg: number;
  ag: number;
  d: string;
}

export interface SeasonData {
  leagueRef: string;
  season: number | null;
  matches: SeasonMatch[];
  teams: Record<string, string>;
}

export interface Injury {
  teamId: string;
  player: string;
  playerId?: string;
  reason: string;
}

export interface Scorer {
  teamId: string;
  player: string;
  playerId?: string;
  goals: number;
}

export interface H2HMatch {
  d: string;
  hg: number;
  ag: number;
}

export interface Provider {
  id: 'apifootball' | 'footballdata';
  label: string;
  /** Vérifie la clé, renvoie un texte d'information. */
  check(): Promise<string>;
  fixturesOfDay(date: string): Promise<Fixture[]>;
  season(leagueRef: string, season: number | null): Promise<SeasonData>;
  injuries(f: Fixture): Promise<Injury[] | null>;
  topScorers(leagueRef: string, season: number | null): Promise<Scorer[] | null>;
  h2h(f: Fixture): Promise<H2HMatch[]>;
  odds(f: Fixture): Promise<number | null>;
}

export interface TeamSeasonStats {
  played: number;
  scored: number;
  conceded: number;
  homePlayed: number;
  homeOver: number;
  awayPlayed: number;
  awayOver: number;
  form: Form[];
}

export class ApiError extends Error {}
