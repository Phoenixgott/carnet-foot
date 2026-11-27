// Bankroll, mises et tableau de bord.
import type { Bet, Settings } from './types';
import { BANDS, oddsBand } from './value';

export function profit(b: Bet): number {
  if (b.result === 'pending') return 0;
  if (typeof b.pnl === 'number' && Number.isFinite(b.pnl)) return b.pnl;
  if (b.result === 'won') return b.stake * (b.odds - 1);
  if (b.result === 'lost') return -b.stake;
  return 0;
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

const settledTime = (b: Bet) => new Date(b.settledAt ?? b.date ?? b.createdAt).getTime();

export function bankroll(bets: Bet[], s: Settings, test: boolean): number {
  return round2(s.bankrollInitial + bets.filter((b) => b.test === test).reduce((a, b) => a + profit(b), 0));
}

/** Mise fixe conseillée : % de la bankroll actuelle. */
export function fixedStake(bets: Bet[], s: Settings, test: boolean): number {
  const br = bankroll(bets, s, test);
  return Math.max(0, round2((br * s.stakePct) / 100));
}

/** Lundi 00:00 (heure locale) de la semaine de la date donnée. */
export function weekStart(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

export interface WeekStatus {
  start: Date;
  /** Résultat net de la semaine (réel). */
  net: number;
  /** Perte nette de la semaine (positive) */
  loss: number;
  limit: number;
  reached: boolean;
  ratio: number;
}

export function weekStatus(bets: Bet[], s: Settings, now = new Date()): WeekStatus {
  const start = weekStart(now);
  const t0 = start.getTime();
  const real = bets.filter((b) => !b.test && b.result !== 'pending');
  const before = real.filter((b) => settledTime(b) < t0).reduce((a, b) => a + profit(b), 0);
  const net = round2(real.filter((b) => settledTime(b) >= t0).reduce((a, b) => a + profit(b), 0));
  const brStart = s.bankrollInitial + before;
  const limit = round2(Math.max(0, (brStart * s.weeklyLossLimitPct) / 100));
  const loss = Math.max(0, -net);
  return { start, net, loss, limit, reached: s.weeklyLossLimitPct > 0 && limit > 0 && loss >= limit, ratio: limit > 0 ? Math.min(1, loss / limit) : 0 };
}

export interface Dashboard {
  count: number;
  settled: number;
  pending: number;
  won: number;
  lost: number;
  voids: number;
  hitRate: number | null;
  staked: number;
  profit: number;
  roi: number | null;
  avgOdds: number | null;
  breakEven: number | null;
  bankroll: number;
  curve: { x: number; y: number; label: string }[];
  streak: { kind: 'won' | 'lost' | null; n: number };
}

export function dashboard(bets: Bet[], s: Settings, test: boolean): Dashboard {
  const list = bets.filter((b) => b.test === test);
  const settledList = list.filter((b) => b.result !== 'pending').sort((a, b) => settledTime(a) - settledTime(b));
  const won = settledList.filter((b) => b.result === 'won').length;
  const lost = settledList.filter((b) => b.result === 'lost').length;
  const voids = settledList.filter((b) => b.result === 'void').length;
  const decided = settledList.filter((b) => b.result === 'won' || b.result === 'lost');
  const staked = round2(decided.reduce((a, b) => a + b.stake, 0));
  const p = round2(settledList.reduce((a, b) => a + profit(b), 0));
  const avgOdds = decided.length ? decided.reduce((a, b) => a + b.odds, 0) / decided.length : null;
  let y = s.bankrollInitial;
  const curve = [{ x: 0, y, label: 'Départ' }];
  settledList.forEach((b, i) => {
    y += profit(b);
    curve.push({ x: i + 1, y: round2(y), label: b.match });
  });
  let streak: Dashboard['streak'] = { kind: null, n: 0 };
  for (let i = decided.length - 1; i >= 0; i--) {
    const r = decided[i].result as 'won' | 'lost';
    if (streak.kind === null) streak = { kind: r, n: 1 };
    else if (streak.kind === r) streak.n++;
    else break;
  }
  return {
    count: list.length,
    settled: settledList.length,
    pending: list.length - settledList.length,
    won,
    lost,
    voids,
    hitRate: decided.length ? won / decided.length : null,
    staked,
    profit: p,
    roi: staked > 0 ? p / staked : null,
    avgOdds,
    breakEven: avgOdds ? 1 / avgOdds : null,
    bankroll: round2(s.bankrollInitial + p),
    curve,
    streak,
  };
}

export function testCount(bets: Bet[]): number {
  return bets.filter((b) => b.test).length;
}

/** Le prochain pari doit-il être fictif (mode TEST) ? */
export function nextBetIsTest(bets: Bet[], s: Settings): boolean {
  return s.testMode && testCount(bets) < s.testBetsTarget;
}

export interface GroupStat {
  label: string;
  n: number;
  won: number;
  rate: number | null;
  profit: number;
  staked: number;
  roi: number | null;
  /** Taux de réussite minimum pour être rentable à la cote moyenne du groupe. */
  breakEven: number | null;
}

function group(bets: Bet[], keyOf: (b: Bet) => string, order?: string[]): GroupStat[] {
  const map = new Map<string, Bet[]>();
  for (const b of bets) {
    if (b.result !== 'won' && b.result !== 'lost') continue;
    const k = keyOf(b) || 'Autre';
    map.set(k, [...(map.get(k) ?? []), b]);
  }
  const keys = order ? order.filter((k) => map.has(k)) : [...map.keys()].sort((a, b) => (map.get(b)!.length - map.get(a)!.length) || a.localeCompare(b));
  return keys.map((label) => {
    const list = map.get(label)!;
    const won = list.filter((b) => b.result === 'won').length;
    const staked = round2(list.reduce((a, b) => a + b.stake, 0));
    const p = round2(list.reduce((a, b) => a + profit(b), 0));
    const avg = list.reduce((a, b) => a + b.odds, 0) / list.length;
    return { label, n: list.length, won, rate: won / list.length, profit: p, staked, roi: staked > 0 ? p / staked : null, breakEven: avg > 1 ? 1 / avg : null };
  });
}

/** Bilan par tranche de cote (moins de 3, 3 à 5, 5 à 8, plus de 8). */
export function byBand(bets: Bet[]): GroupStat[] {
  return group(bets, (b) => oddsBand(b.odds), BANDS);
}

/** Bilan par championnat. */
export function byLeague(bets: Bet[]): GroupStat[] {
  return group(bets, (b) => b.league);
}

/** Bilan selon la value annoncée au moment du pari. */
export function byValue(bets: Bet[]): GroupStat[] {
  return group(bets, (b) => (typeof b.value !== 'number' ? 'Sans calcul' : b.value >= 0.05 ? 'Value OK' : b.value >= 0 ? 'Value bof' : 'Pas de value'), ['Value OK', 'Value bof', 'Pas de value', 'Sans calcul']);
}
