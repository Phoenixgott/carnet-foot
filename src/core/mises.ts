/**
 * Mise conseillée (phase 6) : Kelly fractionné réglable, plafond par pari et par jour,
 * blocage doux (avertissement, jamais un blocage réel : la décision finale reste à l'utilisateur).
 */
import { bankrollCourante, miseConseillee } from "./paris";
import type { Pari, ReglagesBankroll } from "./types";

export type MethodeMise = "fixe" | "kelly";

export interface ReglagesMises {
  methode: MethodeMise;
  /** Fraction du Kelly plein appliquée (1 = plein, 0,5 = demi-Kelly…). */
  fractionKelly: number;
  /** Plafond par pari, en euros (null : aucun). */
  plafondParPari: number | null;
  /** Plafond par jour, en euros (null : aucun). */
  plafondParJour: number | null;
}

export const REGLAGES_MISES_DEFAUT: ReglagesMises = { methode: "fixe", fractionKelly: 0.5, plafondParPari: null, plafondParJour: null };

/**
 * Fraction de la bankroll à miser selon Kelly : f* = (p × cote − 1) / (cote − 1).
 * Négative (pas d'avantage) : 0, jamais une mise négative. `fraction` réduit le résultat
 * (Kelly plein est agressif ; un quart ou un demi-Kelly est d'usage courant).
 */
export function fractionKelly(p: number, cote: number, fraction: number): number {
  if (!(p > 0 && p < 1) || !(cote > 1) || !(fraction > 0)) return 0;
  const f = (p * cote - 1) / (cote - 1);
  return Math.max(0, f) * fraction;
}

/** Mise conseillée par Kelly fractionné, plafonnée à la bankroll. */
export function miseKelly(bankrollCourante: number, p: number, cote: number, fraction: number): number {
  return Math.max(0, bankrollCourante) * fractionKelly(p, cote, fraction);
}

export interface EntreeMiseConseillee {
  paris: readonly Pari[];
  reglagesBankroll: ReglagesBankroll;
  reglagesMises: ReglagesMises;
  /** Probabilité estimée de gagner (nouveau modèle) : nécessaire pour Kelly. */
  p?: number;
  cote?: number;
}

/**
 * Mise conseillée : selon les réglages, un pourcentage fixe de la bankroll (règle du carnet)
 * ou un Kelly fractionné à partir de la probabilité et de la cote du pari envisagé.
 * Sans probabilité ou sans cote, Kelly n'est pas calculable : repli sur la mise fixe.
 */
export function miseConseilleeSelonReglages(e: EntreeMiseConseillee): { montant: number; methode: MethodeMise } {
  const fixe = miseConseillee(e.paris, e.reglagesBankroll);
  if (e.reglagesMises.methode !== "kelly" || e.p === undefined || e.cote === undefined || !Number.isFinite(e.p) || !Number.isFinite(e.cote)) {
    return { montant: fixe, methode: "fixe" };
  }
  const actuelle = bankrollCourante(e.paris, e.reglagesBankroll);
  return { montant: miseKelly(actuelle, e.p, e.cote, e.reglagesMises.fractionKelly), methode: "kelly" };
}

export interface AlerteMise {
  /** Le plafond par pari est dépassé. */
  parPari: boolean;
  /** Le plafond par jour serait dépassé en ajoutant cette mise. */
  parJour: { depasse: boolean; dejaEngage: number; plafond: number } | null;
}

/** Mises déjà engagées un jour donné (tous statuts : l'argent est déjà misé, gagné ou non). */
export function miseEngageeCeJour(paris: readonly Pari[], jour: string): number {
  return paris.filter((p) => p.date === jour).reduce((s, p) => s + p.mise, 0);
}

/** Avertissements (jamais un blocage) quand une mise envisagée dépasse un plafond réglé. */
export function alerteMise(paris: readonly Pari[], reglages: ReglagesMises, jour: string, mise: number): AlerteMise {
  const parPari = reglages.plafondParPari !== null && mise > reglages.plafondParPari;
  const parJour =
    reglages.plafondParJour !== null
      ? (() => {
          const dejaEngage = miseEngageeCeJour(paris, jour);
          return { depasse: dejaEngage + mise > reglages.plafondParJour!, dejaEngage, plafond: reglages.plafondParJour! };
        })()
      : null;
  return { parPari, parJour };
}

/** Réglages complets à partir de ce qui est enregistré : valeurs manquantes ou fausses → défaut. */
export function completerReglagesMises(x: unknown): ReglagesMises {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof ReglagesMises, unknown>>;
  const nombreOuNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const fraction = typeof o.fractionKelly === "number" && o.fractionKelly > 0 && o.fractionKelly <= 1 ? o.fractionKelly : REGLAGES_MISES_DEFAUT.fractionKelly;
  return {
    methode: o.methode === "kelly" ? "kelly" : "fixe",
    fractionKelly: fraction,
    plafondParPari: nombreOuNull(o.plafondParPari),
    plafondParJour: nombreOuNull(o.plafondParJour),
  };
}
