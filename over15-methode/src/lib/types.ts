// Types partagés de l'application « Over 1.5 – Méthode » (version 2 : méthode live de la vidéo).

export type Verdict = 'GREEN' | 'ORANGE' | 'RED';
export type Form = 'V' | 'N' | 'D';
export type Check = 'ok' | 'warn' | 'fail' | 'unknown';
export type BetResult = 'pending' | 'won' | 'lost' | 'void';
export type Context = 'normal' | 'finale' | 'derby' | 'maintien' | 'montee' | 'sans_enjeu' | 'inconnu';

export interface Scorer {
  name: string;
  goals: number | null;
  /** true = disponible, false = absent (blessé, suspendu), null = on ne sait pas. */
  available: boolean | null;
}

export interface TeamData {
  name: string;
  /** Saison en cours, toutes compétitions. */
  played: number | null;
  scored: number | null;
  conceded: number | null;
  /** Nombre de matchs avec au moins 2 buts. */
  over15: number | null;
  scorers: Scorer[];
  /** Autres absents importants en attaque. */
  absents: string[];
}

export interface MatchData {
  id: string;
  date: string;
  time: string;
  competition: string;
  home: TeamData;
  away: TeamData;
  /** Derniers scores des confrontations directes, « 2-1 ». */
  h2h: string[];
  context: Context;
  contextDetail: string;
  preOdds: number | null;
  sources: string[];
  importedAt: string;
}

export interface Hedge {
  kind: 'contraire' | 'cashout';
  /** Cote du pari contraire « Moins de 1,5 but ». */
  odds?: number;
  /** Mise du pari contraire, ou montant du cash-out encaissé. */
  amount: number;
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
  /** Minute d'entrée en live. */
  minute?: number | null;
  hedge?: Hedge | null;
  /** Gain ou perte réel quand le pari a été sécurisé. */
  pnl?: number;
}

export type LiveStage = 'attente' | 'chrono' | 'parie' | 'but' | 'fini';

export interface LiveSession {
  matchId: string | null;
  label: string;
  competition: string;
  /** Buts attendus sur le match (pour estimer les chances en live). */
  lambda: number;
  verdict: Verdict | null;
  /** Horodatage du coup d'envoi (ms), corrigé quand on recale la minute. */
  kickoffAt: number | null;
  stage: LiveStage;
  betId: string | null;
  /** Étape de questions pendant la fenêtre d'entrée. */
  q: 'score' | 'anime' | 'cote';
  endText?: string;
}

export interface Settings {
  bankrollInitial: number;
  stakePct: number;
  weeklyLossLimitPct: number;
  testMode: boolean;
  testBetsTarget: number;
  /** Cote minimum pour entrer en live (Steven : en moyenne plus de 1,70). */
  minLiveOdds: number;
  entryFrom: number;
  entryTo: number;
  /** Après cette minute, on n'entre plus. */
  lastEntry: number;
  /** Buts marqués ET encaissés minimum par match. */
  teamMin: number;
  /** % minimum de matchs à +1,5 but pour chaque équipe. */
  over15Min: number;
  maxMatches: number;
  competitions: string;
  haptics: boolean;
  intro: boolean;
  ageConfirmed: boolean;
}

export interface AppData {
  version: 2;
  settings: Settings;
  matches: MatchData[];
  matchesDate: string | null;
  bets: Bet[];
  live: LiveSession | null;
}
