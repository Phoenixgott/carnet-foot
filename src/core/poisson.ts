/**
 * Loi de Poisson appliquée au nombre de buts d'un match.
 *
 * Hypothèse : le nombre total de buts suit une loi de Poisson de moyenne λ
 * (« buts attendus »). C'est une approximation : elle ne tient pas compte,
 * par exemple, de la corrélation entre les scores des deux équipes.
 */

/** Probabilité d'avoir au plus `n` buts quand on en attend `lambda`. */
export function pAuPlus(lambda: number, n: number): number {
  let somme = 0;
  let terme = Math.exp(-lambda);
  for (let k = 0; k <= n; k++) {
    if (k > 0) terme *= lambda / k;
    somme += terme;
  }
  return somme;
}

/**
 * Probabilité de dépasser une ligne de buts (1,5 → au moins 2 buts ;
 * 2,5 → au moins 3 buts).
 */
export function pPlusDe(lambda: number, ligne: number): number {
  return 1 - pAuPlus(lambda, Math.floor(ligne));
}

/**
 * Buts attendus sur le reste du match à partir d'une minute donnée
 * (modèle du carnet d'origine) : buts répartis uniformément,
 * avec 3 minutes d'arrêts de jeu ajoutées.
 */
export function lambdaRestant(lambda: number, minute: number): number {
  return (lambda * Math.max(90 - minute + 3, 0)) / 90;
}
