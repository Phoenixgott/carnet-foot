// Stockage local (100 % hors ligne) avec abonnement React.
import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, defaultData } from './defaults';
import type { AppData, Bet, LiveSession, MatchData, Settings } from './types';

const KEY = 'over15:data:v2';
const OLD_KEY = 'over15:data:v1';
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

/** Complète des données (version 1, version 2 ou importées) avec les valeurs par défaut. */
export function normalize(input: unknown): AppData {
  const base = defaultData();
  if (!input || typeof input !== 'object') return base;
  const d = input as Partial<AppData> & { settings?: Partial<Settings> };
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = d.settings?.[k];
    if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[k]) (settings as unknown as Record<string, unknown>)[k] = v;
  }
  const bets: Bet[] = Array.isArray(d.bets)
    ? d.bets.filter((b) => b && typeof b.id === 'string' && typeof b.odds === 'number' && typeof b.stake === 'number').map((b) => ({ ...BET_DEFAULTS, ...b }))
    : [];
  const matches: MatchData[] = Array.isArray(d.matches) ? d.matches.filter((m) => m && typeof m.id === 'string' && m.home && m.away) : [];
  const live: LiveSession | null = d.live && typeof d.live === 'object' && 'stage' in d.live ? (d.live as LiveSession) : null;
  return { version: 2, settings, matches, matchesDate: typeof d.matchesDate === 'string' ? d.matchesDate : null, bets, live };
}

function load(): AppData {
  try {
    const cur = safeParse(localStorage.getItem(KEY));
    if (cur) return normalize(cur);
    // Reprise des données de la version 1 (bankroll, réglages communs, paris).
    const old = safeParse(localStorage.getItem(OLD_KEY));
    return normalize(old);
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

function backupNow() {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

// Actions ---------------------------------------------------------------

export const actions = {
  updateSettings(patch: Partial<Settings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  setMatches(matches: MatchData[], date: string) {
    setState((s) => ({ ...s, matches, matchesDate: date }));
  },
  addMatches(matches: MatchData[]) {
    setState((s) => ({ ...s, matches: [...matches, ...s.matches] }));
  },
  updateMatch(id: string, patch: Partial<MatchData>) {
    setState((s) => ({ ...s, matches: s.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  },
  deleteMatch(id: string) {
    setState((s) => ({ ...s, matches: s.matches.filter((m) => m.id !== id) }));
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
  setLive(live: LiveSession | null) {
    setState((s) => ({ ...s, live }));
  },
  updateLive(patch: Partial<LiveSession>) {
    setState((s) => (s.live ? { ...s, live: { ...s.live, ...patch } } : s));
  },
  replaceAll(data: AppData) {
    backupNow();
    state = normalize(data);
    persistNow();
    listeners.forEach((l) => l());
  },
  resetAll() {
    backupNow();
    const keep = state.settings.ageConfirmed;
    state = defaultData();
    state.settings.ageConfirmed = keep;
    persistNow();
    listeners.forEach((l) => l());
  },
};
