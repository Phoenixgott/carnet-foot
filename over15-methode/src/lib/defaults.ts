import type { AnalysisInput, AppData, League, Settings, TeamInput } from './types';

export const DEFAULT_LEAGUES: League[] = [
  { id: 'ligue1', name: 'Ligue 1', country: 'France', flag: '🇫🇷', pct: 89, inMethod: true, builtin: true, apiFootballId: 61, footballDataCode: 'FL1' },
  { id: 'bundesliga', name: 'Bundesliga', country: 'Allemagne', flag: '🇩🇪', pct: 87, inMethod: true, builtin: true, apiFootballId: 78, footballDataCode: 'BL1' },
  { id: 'premier-league', name: 'Premier League', country: 'Angleterre', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', pct: 81, inMethod: true, builtin: true, apiFootballId: 39, footballDataCode: 'PL' },
  { id: 'serie-a', name: 'Serie A', country: 'Italie', flag: '🇮🇹', pct: 78, inMethod: true, builtin: true, apiFootballId: 135, footballDataCode: 'SA' },
  { id: 'liga', name: 'Liga', country: 'Espagne', flag: '🇪🇸', pct: 75, inMethod: true, builtin: true, apiFootballId: 140, footballDataCode: 'PD' },
];

export const DEFAULT_SETTINGS: Settings = {
  bankrollInitial: 200,
  stakePct: 2,
  weeklyLossLimitPct: 10,
  testMode: true,
  testBetsTarget: 20,
  leagueThreshold: 85,
  weights: { league: 20, teams: 20, homeAway: 25, injuries: 10, h2h: 15, odds: 10 },
  greenMin: 75,
  orangeMin: 55,
  teamMinScored: 1.0,
  teamMinConceded: 0.8,
  homeAwayMin: 75,
  oddsMin: 1.3,
  oddsMax: 1.4,
  blocking: { outOfMethod: true, belowThreshold: false, teams: true, oddsOutOfRange: false, h2hLow: false },
  haptics: true,
  intro: true,
  provider: 'none',
  apiKey: '',
  ageConfirmed: false,
};

export function emptyTeam(): TeamInput {
  return { name: '', played: null, scored: null, conceded: null, form: [] };
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayISO(d = new Date()): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function newAnalysis(): AnalysisInput {
  return {
    id: uid(),
    step: 0,
    date: todayISO(),
    leagueId: null,
    otherLeagueName: '',
    leaguePct: null,
    home: emptyTeam(),
    away: emptyTeam(),
    homePct: null,
    awayPct: null,
    homeScorer: '',
    awayScorer: '',
    homeScorerOk: null,
    awayScorerOk: null,
    otherAbsences: 0,
    injuries: [],
    h2h: ['', '', '', '', ''],
    h2hNone: false,
    odds: null,
    notes: [],
  };
}

export function defaultData(): AppData {
  return {
    version: 1,
    settings: structuredClone(DEFAULT_SETTINGS),
    leagues: structuredClone(DEFAULT_LEAGUES),
    bets: [],
    draft: null,
  };
}

export const OTHER_LEAGUE = '__autre__';
