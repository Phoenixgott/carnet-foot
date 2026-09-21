/**
 * Marge du bookmaker sur un marché à deux issues (plus de / moins de X buts).
 *
 * Avec des cotes justes, 1/plus + 1/moins = 1. Le bookmaker baisse ses cotes :
 * la somme dépasse 1, et l'excédent est sa marge. Ex. 1,80 et 1,95 : 1/1,80 + 1/1,95 − 1 = 6,8 %.
 */
import { estNombre } from "./format";

/** Marge (0,068 pour 6,8 %) ; NaN si une des deux cotes manque ou est impossible (≤ 1). */
export function margeBookmaker(plus: number | null | undefined, moins: number | null | undefined): number {
  if (!estNombre(plus) || !estNombre(moins) || plus <= 1 || moins <= 1) return NaN;
  return 1 / plus + 1 / moins - 1;
}

/**
 * Probabilité « sans marge » de l'issue « plus de » selon le bookmaker :
 * on retire sa marge en ramenant la somme des deux probabilités à 1.
 */
export function probabiliteSansMarge(plus: number | null | undefined, moins: number | null | undefined): number {
  const m = margeBookmaker(plus, moins);
  if (!Number.isFinite(m)) return NaN;
  return 1 / (plus as number) / (1 + m);
}
