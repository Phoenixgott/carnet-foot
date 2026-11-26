// Types partagés de l'application « Over 1.5 – Méthode ».

export type Verdict = 'GREEN' | 'ORANGE' | 'RED';
export type Form = 'V' | 'N' | 'D';
export type BetResult = 'pending' | 'won' | 'lost' | 'void';
export type ProviderId = 'none' | 'apifootball' | 'footballdata';

export interface League {
  id: string;
  name: string;
  country: string;
  flag: string;
  /** % de matchs avec au moins 2 buts sur 90 minutes (valeur de référence). */
  pct: number;
  /** false = ligue « exotique », hors méthode. */
  inMethod: boolean;
  builtin: boolean;
  apiFootballId?: number;
  footballDataCode?: string;
  /** Dernière valeur calculée via l'API (saison en cours). */
  apiPct?: number;
  apiSample?: number;
  apiAt?: number;
}

export interface Weights {
  league: number;
  teams: number;
  homeAway: number;
  injuries: number;
  h2h: number;
  odds: number;
}

export interface BlockingRules {
  /** Ligue hors méthode → rouge. */
  outOfMethod: boolean;
  /** Ligue sous le seuil → rouge. */
  belowThreshold: boolean;
  /** Une équipe ne marque pas ET n'encaisse pas assez → rouge. */
  teams: boolean;
  /** Cote hors fourchette → rouge. */
  oddsOutOfRange: boolean;
  /** Confrontations aux petits scores → rouge. */
  h2hLow: boolean;
}

export interface Settings {
  bankrollInitial: number;
  stakePct: number;
  weeklyLossLimitPct: number;
  testMode: boolean;
  testBetsTarget: number;
  leagueThreshold: number;
  weights: Weights;
  greenMin: number;
  orangeMin: number;
  teamMinScored: number;
  teamMinConceded: number;
  homeAwayMin: number;
  oddsMin: number;
  oddsMax: number;
  blocking: BlockingRules;
  haptics: boolean;
  intro: boolean;
  provider: ProviderId;
  apiKey: string;
  ageConfirmed: boolean;
}

export interface TeamInput {
  id?: string;
  name: string;
  played: number | null;
  scored: number | null;
  conceded: number | null;
  form: Form[];
  logo?: string;
}

export interface InjuryLine {
  side: 'home' | 'away';
  player: string;
  reason: string;
}

export interface FixtureLink {
  provider: Exclude<ProviderId, 'none'>;
  id: string;
  leagueRef: string;
  season: number | null;
}

export interface AnalysisInput {
  id: string;
  step: number;
  date: string;
  fixture?: FixtureLink;
  leagueId: string | null;
  /** Nom saisi quand la ligue n'est pas dans la liste (forcément hors méthode). */
  otherLeagueName: string;
  leaguePct: number | null;
  home: TeamInput;
  away: TeamInput;
  homePct: number | null;
  awayPct: number | null;
  homeScorer: string;
  awayScorer: string;
  homeScorerOk: boolean | null;
  awayScorerOk: boolean | null;
  otherAbsences: number;
  injuries: InjuryLine[];
  h2h: string[];
  h2hNone: boolean;
  odds: number | null;
  /** Infos venant de l'API (affichage). */
  notes: string[];
}

export interface Bet {
  id: string;
  createdAt: string;
  date: string;
  match: string;
  home: string;
  away: string;
  league: string;
  odds: number;
  stake: number;
  kind: 'simple' | 'combine';
  live: boolean;
  test: boolean;
  verdict: Verdict | null;
  score: number | null;
  result: BetResult;
  settledAt?: string;
  note?: string;
}

export interface AppData {
  version: 1;
  settings: Settings;
  leagues: League[];
  bets: Bet[];
  draft: AnalysisInput | null;
}
