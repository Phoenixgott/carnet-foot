/**
 * Répartition des buts dans le temps (pour le live, méthode +1.5).
 *
 * Le carnet supposait un rythme uniforme sur 90 minutes + 3 minutes d'arrêts.
 * En réalité, on marque un peu moins en début de match et davantage en fin de mi-temps
 * (fatigue, arrêts de jeu) : environ 45 % des buts en 1re mi-temps, 55 % en 2de.
 * Parts par tranche de 15 minutes : ordres de grandeur des grands championnats européens
 * (arrêts de jeu inclus dans la dernière tranche de chaque mi-temps). Quand les historiques CSV
 * donnent la part réelle des buts en 1re mi-temps d'un championnat, les tranches sont ajustées.
 */

/** Part des buts par tranche : 0-15, 15-30, 30-45+, 45-60, 60-75, 75-90+. Somme = 1. */
export const REPARTITION_PAR_DEFAUT: readonly number[] = [0.135, 0.15, 0.17, 0.165, 0.175, 0.205];

export const PART_PREMIERE_MI_TEMPS_DEFAUT = REPARTITION_PAR_DEFAUT.slice(0, 3).reduce((s, x) => s + x, 0);

/** Répartition ajustée à la part réelle des buts en 1re mi-temps (ex. 0,44 d'après les CSV). */
export function repartition(partPremiereMiTemps: number | null | undefined): number[] {
  const f1 = partPremiereMiTemps;
  if (f1 === null || f1 === undefined || !Number.isFinite(f1) || f1 <= 0.2 || f1 >= 0.8) return [...REPARTITION_PAR_DEFAUT];
  const k1 = f1 / PART_PREMIERE_MI_TEMPS_DEFAUT;
  const k2 = (1 - f1) / (1 - PART_PREMIERE_MI_TEMPS_DEFAUT);
  return REPARTITION_PAR_DEFAUT.map((x, i) => x * (i < 3 ? k1 : k2));
}

/** Part des buts d'un match déjà « jouée » à cette minute (0 au coup d'envoi, 1 à la fin). */
export function partJouee(minute: number, rep: readonly number[] = REPARTITION_PAR_DEFAUT): number {
  const m = Math.min(Math.max(minute, 0), 90);
  let part = 0;
  for (let i = 0; i < 6; i++) {
    const debut = i * 15;
    if (m >= debut + 15) part += rep[i];
    else {
      part += (rep[i] * (m - debut)) / 15;
      break;
    }
  }
  return Math.min(part, 1);
}

/**
 * Buts attendus sur le reste du match, quand `buts` buts sont tombés à cette minute.
 *
 * Deux effets : il reste une part (1 − partJouee) des buts ; et ce qui s'est passé est une
 * information (0-0 : le match est peut-être plus fermé que prévu ; un but : plus ouvert). On la prend
 * en compte avec l'incertitude de l'estimation (écart type `sigma`) : plus on est sûr des buts
 * attendus, moins le score les fait bouger. (Loi Gamma sur λ, mise à jour après `buts` buts observés.)
 */
export function lambdaRestantApres(
  lambda: number,
  sigma: number,
  minute: number,
  buts: number,
  rep: readonly number[] = REPARTITION_PAR_DEFAUT,
): number {
  const joue = partJouee(minute, rep);
  if (!Number.isFinite(lambda) || lambda <= 0) return NaN;
  const forme = Number.isFinite(sigma) && sigma > 0 ? (lambda / sigma) ** 2 : Infinity;
  const lambdaApres = Number.isFinite(forme) ? ((forme + buts) * lambda) / (forme + lambda * joue) : lambda;
  return lambdaApres * (1 - joue);
}

/** Buts attendus sur le reste du match, à 0-0 à cette minute. */
export function lambdaRestantA00(lambda: number, sigma: number, minute: number, rep: readonly number[] = REPARTITION_PAR_DEFAUT): number {
  return lambdaRestantApres(lambda, sigma, minute, 0, rep);
}
