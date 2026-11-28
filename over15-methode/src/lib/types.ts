// Types partagés de l'application « Outsiders » (version 3 : paris value sur les outsiders).

export type BetResult = 'pending' | 'won' | 'lost' | 'void';
export type Verdict = 'OK' | 'BOF' | 'NON';
export type ProbSource = 'pinnacle' | 'pinnacle1' | 'mix' | 'elo' | 'claude' | 'perso';

export interface PinnacleOdds {
  /** Cote Pinnacle de l'outsider. */
  out: number | null;
  /** Cote du match nul (si pari victoire en 1-N-2). */
  draw: number | null;
  /** Cote du favori. */
  fav: number | null;
}

/** Bilan d'une équipe à domicile (si elle reçoit) ou à l'extérieur. */
export interface Venue {
  played: number | null;
  w: number | null;
  d: number | null;
  l: number | null;
  gf: number | null;
  ga: number | null;
}

/** Tous les chiffres d'une équipe, pour décider soi-même. */
export interface TeamFacts {
  name: string;
  odds: number | null;
  pinnacle: number | null;
  rank: number | null;
  points: number | null;
  played: number | null;
  /** Points d'avance (+) ou de retard (−) sur la zone de relégation. */
  zoneGap: number | null;
  /** maintien, titre, europe, milieu, montée… */
  goal: string;
  /** 5 derniers matchs, le plus récent à gauche : « VNDDV ». */
  form: string;
  venue: Venue | null;
  scored: number | null;
  conceded: number | null;
  /** xG pour et contre, par match. */
  xgFor: number | null;
  xgAgainst: number | null;
  scorers: { name: string; goals: number | null; available: boolean | null }[];
  absents: { name: string; reason: string; key: boolean | null }[];
  lastMatch: string;
  restDays: number | null;
  europe: boolean | null;
  coach: string;
  newCoach: boolean | null;
  elo: number | null;
}

export interface MatchContext {
  stakes: string;
  link: string;
  h2h: string[];
  oddsMoveDetail: string;
  weather: string;
  referee: string;
  extra: string[];
  drawOdds: number | null;
}

/** Un outsider proposé par Claude. */
export interface Outsider {
  id: string;
  date: string;
  time: string;
  competition: string;
  home: string;
  away: string;
  /** L'équipe outsider sur laquelle on parie. */
  team: string;
  /** Le pari, en clair : « Victoire de … ». */
  bet: string;
  /** Cote chez un bookmaker français. */
  odds: number | null;
  bookmaker: string;
  pinnacle: PinnacleOdds;
  /** Estimation de Claude (0 à 1) si pas de Pinnacle. */
  estimate: number | null;
  reasonsFor: string[];
  reasonsAgainst: string[];
  signals: {
    xg: string;
    absentsFav: string[];
    fatigueFav: boolean | null;
    motivation: string;
    oddsMove: 'baisse' | 'hausse' | 'stable' | 'inconnu';
  };
  sources: string[];
  importedAt: string;
  /** Fiche détaillée (nouveau format) : l'outsider, le favori et le contexte. */
  out?: TeamFacts;
  fav?: TeamFacts;
  ctx?: MatchContext;
}

export interface Bet {
  id: string;
  createdAt: string;
  date: string;
  match: string;
  home: string;
  away: string;
  league: string;
  /** Le pari en clair (ex. « Victoire de Lens »). */
  pick?: string;
  odds: number;
  stake: number;
  kind: 'simple' | 'combine';
  live: boolean;
  test: boolean;
  /** Ancien champ (version Over 1.5) : conservé pour l'historique. */
  verdict: string | null;
  score: number | null;
  result: BetResult;
  settledAt?: string;
  note?: string;
  /** Vraie chance estimée au moment du pari (0 à 1). */
  pTrue?: number | null;
  /** Value au moment du pari (0,12 = +12 %). */
  value?: number | null;
  source?: ProbSource | null;
  /** Score final (rempli par Claude ou à la main). */
  finalScore?: string;
  /** Gain ou perte réel quand il diffère du calcul simple (ancien pari sécurisé). */
  pnl?: number;
  minute?: number | null;
  hedge?: unknown;
}

export interface Settings {
  bankrollInitial: number;
  stakePct: number;
  weeklyLossLimitPct: number;
  testMode: boolean;
  testBetsTarget: number;
  /** Value minimum pour dire « OK » (0,05 = +5 %). */
  valueMin: number;
  /** Cote minimum pour parler d'outsider. */
  minOdds: number;
  /** Marge retirée quand on n'a que la cote Pinnacle de l'outsider. */
  pinnacleMargin: number;
  maxPicks: number;
  /** Chasse aux grosses cotes : cote minimum et nombre de matchs. */
  huntMinOdds: number;
  huntCount: number;
  competitions: string;
  bookmakers: string;
  haptics: boolean;
  intro: boolean;
  ageConfirmed: boolean;
}

export interface AppData {
  version: 3;
  settings: Settings;
  picks: Outsider[];
  picksDate: string | null;
  bets: Bet[];
}
