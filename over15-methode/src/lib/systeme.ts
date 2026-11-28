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
