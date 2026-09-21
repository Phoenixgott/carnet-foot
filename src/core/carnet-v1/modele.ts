/**
 * Modèle de buts attendus du carnet d'origine (v1), repris à l'identique.
 *
 * λ = (attaque domicile + défense extérieur) / 2 + (attaque extérieur + défense domicile) / 2
 * où « attaque » = buts marqués par match et « défense » = buts encaissés par match.
 * Limites connues (corrigées en phase 3) : pas d'avantage du terrain,
 * pas de comparaison avec la moyenne de la compétition.
 */
import { estNombre } from "../format";
import type { Equipe, Match } from "../types";

export interface Moyennes {
  /** Buts marqués par match (NaN si inconnu). */
  s: number;
  /** Buts encaissés par match (NaN si inconnu). */
  c: number;
}

/** Moyennes par match d'une équipe (le `avgs` du carnet). */
export function moyennes(t: Equipe | null | undefined): Moyennes {
  if (t && estNombre(t.joues) && t.joues > 0) {
    return {
      s: estNombre(t.marques) ? t.marques / t.joues : NaN,
      c: estNombre(t.encaisses) ? t.encaisses / t.joues : NaN,
    };
  }
  return { s: NaN, c: NaN };
}

/** Buts attendus sur 90 minutes (le `lambdaOf` du carnet). NaN si une donnée manque. */
export function butsAttendus(m: Match): number {
  const h = moyennes(m.domicile);
  const a = moyennes(m.exterieur);
  return (h.s + a.c) / 2 + (a.s + h.c) / 2;
}
