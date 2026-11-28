import type { AppData, Settings } from './types';

export const DEFAULT_COMPETITIONS =
  'les championnats européens (Ligue 1, Premier League, Liga, Serie A, Bundesliga, Pays-Bas, Portugal, Belgique, Turquie…), les coupes d\'Europe, et les autres championnats suivis par les bookmakers français (Arabie saoudite, Brésil…)';

export const EUROPE_COMPETITIONS =
  'tous les championnats européens de 1re et 2e division (Angleterre, Espagne, Italie, Allemagne, France, Portugal, Pays-Bas, Belgique, Turquie, Écosse, Suisse, Autriche, Grèce, Danemark, Norvège, Suède, Pologne, Tchéquie, Croatie, Serbie…), la Ligue des champions, la Ligue Europa, la Ligue Conférence et les coupes nationales';

export const DEFAULT_BOOKMAKERS = 'Winamax, Unibet, Betclic ou Parions Sport';

export const DEFAULT_SETTINGS: Settings = {
  bankrollInitial: 200,
  stakePct: 1,
  weeklyLossLimitPct: 10,
  testMode: true,
  testBetsTarget: 20,
  valueMin: 0.05,
  minOdds: 3,
  pinnacleMargin: 0.03,
  maxPicks: 4,
  huntMinOdds: 3.8,
  huntCount: 6,
  competitions: DEFAULT_COMPETITIONS,
  bookmakers: DEFAULT_BOOKMAKERS,
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
    version: 3,
    settings: structuredClone(DEFAULT_SETTINGS),
    picks: [],
    picksDate: null,
    bets: [],
  };
}
