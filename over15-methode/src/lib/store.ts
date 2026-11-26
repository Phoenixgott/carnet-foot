// Stockage local (100 % hors ligne) avec abonnement React.
import { useSyncExternalStore } from 'react';
import { DEFAULT_LEAGUES, DEFAULT_SETTINGS, defaultData } from './defaults';
import type { AppData, Bet, League, Settings } from './types';

const KEY = 'over15:data:v1';
const BACKUP_KEY = 'over15:data:avant-import';

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const BET_DEFAULTS: Pick<Bet, 'kind' | 'live' | 'test' | 'verdict' | 'score' | 'result' | 'league' | 'home' | 'away'> = {
  kind: 'simple',
  live: false,
  test: false,
  verdict: null,
  score: null,
  result: 'pending',
  league: '',
  home: '',
  away: '',
};

/** Complète des données (anciennes ou importées) avec les valeurs par défaut. */
export function normalize(input: unknown): AppData {
  const base = defaultData();
  if (!input || typeof input !== 'object') return base;
  const d = input as Partial<AppData>;
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...(d.settings ?? {}),
    weights: { ...DEFAULT_SETTINGS.weights, ...(d.settings?.weights ?? {}) },
    blocking: { ...DEFAULT_SETTINGS.blocking, ...(d.settings?.blocking ?? {}) },
  };
  const leagues: League[] = Array.isArray(d.leagues) && d.leagues.length ? d.leagues.filter((l) => l && typeof l.id === 'string') : structuredClone(DEFAULT_LEAGUES);
  const bets: Bet[] = Array.isArray(d.bets)
    ? d.bets
        .filter((b) => b && typeof b.id === 'string' && typeof b.odds === 'number' && typeof b.stake === 'number')
        .map((b) => ({ ...BET_DEFAULTS, ...b }))
    : [];
  return { version: 1, settings, leagues, bets, draft: d.draft ?? null };
}

function load(): AppData {
  try {
    return normalize(safeParse(localStorage.getItem(KEY)));
  } catch {
    return defaultData();
  }
}

let state: AppData = load();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persistNow() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* stockage plein ou indisponible */
  }
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 150);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', persistNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistNow();
  });
}

export function getState(): AppData {
  return state;
}

export function setState(updater: (s: AppData) => AppData) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: AppData) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

// Actions ---------------------------------------------------------------

export const actions = {
  updateSettings(patch: Partial<Settings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  setLeagues(leagues: League[]) {
    setState((s) => ({ ...s, leagues }));
  },
  updateLeague(id: string, patch: Partial<League>) {
    setState((s) => ({ ...s, leagues: s.leagues.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  },
  addBet(bet: Bet) {
    setState((s) => ({ ...s, bets: [bet, ...s.bets] }));
  },
  updateBet(id: string, patch: Partial<Bet>) {
    setState((s) => ({ ...s, bets: s.bets.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  },
  deleteBet(id: string) {
    setState((s) => ({ ...s, bets: s.bets.filter((b) => b.id !== id) }));
  },
  setDraft(draft: AppData['draft']) {
    setState((s) => ({ ...s, draft }));
  },
  replaceAll(data: AppData) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    state = normalize(data);
    persistNow();
    listeners.forEach((l) => l());
  },
  resetAll() {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    const keep = state.settings.ageConfirmed;
    state = defaultData();
    state.settings.ageConfirmed = keep;
    persistNow();
    listeners.forEach((l) => l());
  },
};
