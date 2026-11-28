// Système de doubles : on joue tous les doubles possibles entre N matchs (6 matchs = 15 doubles).
// Remboursé si les doubles gagnants rapportent au moins la mise totale.

/** Nombre de façons de choisir k éléments parmi n. */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Arrondi au 0,05 supérieur (comme les cotes affichées). */
export function ceil05(x: number): number {
  return Math.ceil(x * 20 - 1e-9) / 20;
}

export function doublesCount(n: number): number {
  return choose(n, 2);
}

/** Avec 2 bons pronostics : cote minimum du 2e match selon la cote du 1er. */
export function minSecondOdds(n: number, firstOdds: number): number {
  return ceil05(doublesCount(n) / firstOdds);
}

/** Avec k bons pronostics de cotes proches : cote minimum par match pour être remboursé. */
export function minOddsWithKGood(n: number, k: number): number {
  const wins = choose(k, 2);
  if (wins === 0) return Infinity;
  return Math.max(1, ceil05(Math.sqrt(doublesCount(n) / wins)));
}

export interface SystemResult {
  doubles: number;
  totalStake: number;
  winningDoubles: number;
  payout: number;
  profit: number;
  refunded: boolean;
}

/** Calcule un système : cotes des matchs, et lesquels sont gagnés. */
export function evaluateSystem(odds: number[], won: boolean[], stakePerDouble: number): SystemResult {
  const n = odds.length;
  const doubles = doublesCount(n);
  const totalStake = Math.round(doubles * stakePerDouble * 100) / 100;
  let payout = 0;
  let winningDoubles = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (won[i] && won[j]) {
        winningDoubles++;
        payout += stakePerDouble * odds[i] * odds[j];
      }
    }
  }
  payout = Math.round(payout * 100) / 100;
  const profit = Math.round((payout - totalStake) * 100) / 100;
  return { doubles, totalStake, winningDoubles, payout, profit, refunded: payout >= totalStake - 0.005 };
}

/** Les lignes du tableau (cote du 1er match → cote minimum du 2e). */
export const FIRST_ODDS = [2, 2.5, 3, 3.5, 4, 5];

// ---------- Quelle cote prendre sur chaque match ? ----------

/** Marge du bookmaker retirée pour estimer la chance réelle d'un match : 1 ÷ cote ÷ (1 + marge). */
export const BOOK_MARGIN = 0.05;

function round05(x: number): number {
  return Math.round(x * 20) / 20;
}

/** Nombre de bons pronostics nécessaires pour être remboursé, si tous les matchs ont la même cote. */
export function requiredGood(n: number, odds: number): number {
  const d = doublesCount(n);
  for (let k = 2; k <= n; k++) if (choose(k, 2) * odds * odds >= d - 1e-9) return k;
  return n;
}

/** Chance d'être au moins remboursé avec n matchs à la même cote (loi binomiale). */
export function refundChance(n: number, odds: number, margin = BOOK_MARGIN): number {
  const p = Math.min(0.99, 1 / odds / (1 + margin));
  const k = requiredGood(n, odds);
  let s = 0;
  for (let i = k; i <= n; i++) s += choose(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  return s;
}

export interface Zone {
  good: number;
  from: number;
  to: number;
  chance: number;
}

export interface AvoidZone {
  good: number;
  from: number;
  to: number;
  chanceFrom: number;
  chanceTo: number;
}

/** Les zones de cotes qui maximisent la chance d'être remboursé, et celles à éviter. */
export function refundZones(n: number): { best: Zone[]; avoid: AvoidZone[]; above: number } {
  const ks: number[] = [];
  for (let k = Math.max(2, n - 2); k >= 2; k--) ks.push(k);
  const best = ks.map((k) => {
    const from = minOddsWithKGood(n, k);
    const to = round05(from * 1.075);
    return { good: k, from, to, chance: refundChance(n, (from + to) / 2) };
  });
  const avoid: AvoidZone[] = [];
  for (let i = 0; i < best.length - 1; i++) {
    const from = round05(best[i].to + 0.1);
    const to = round05(best[i + 1].from - 0.15);
    if (to > from) avoid.push({ good: best[i].good, from, to, chanceFrom: refundChance(n, from), chanceTo: refundChance(n, to) });
  }
  const last = best[best.length - 1];
  return { best, avoid, above: last ? round05(last.to + 0.1) : 0 };
}
