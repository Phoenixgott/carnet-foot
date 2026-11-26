import type { AppData, Settings } from './types';

export const DEFAULT_COMPETITIONS =
  'toutes les grandes compétitions : Ligue 1, Premier League, Liga, Serie A, Bundesliga, Ligue des champions, Ligue Europa, Ligue Conférence, Ligue des nations, Série A brésilienne, et les autres championnats suivis';

export const DEFAULT_SETTINGS: Settings = {
  bankrollInitial: 200,
  stakePct: 2,
  weeklyLossLimitPct: 10,
  testMode: true,
  testBetsTarget: 20,
  minLiveOdds: 1.7,
  entryFrom: 15,
  entryTo: 20,
  lastEntry: 30,
  teamMin: 1,
  over15Min: 75,
  maxMatches: 8,
  competitions: DEFAULT_COMPETITIONS,
  haptics: true,
  intro: true,
  ageConfirmed: false,
};

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayISO(d = new Date()): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function defaultData(): AppData {
  return {
    version: 2,
    settings: structuredClone(DEFAULT_SETTINGS),
    matches: [],
    matchesDate: null,
    bets: [],
    live: null,
  };
}
