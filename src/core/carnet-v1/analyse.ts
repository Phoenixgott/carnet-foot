/**
 * Synthèse par match et par méthode (carnet d'origine, repris à l'identique) :
 * verdict final, probabilité, cote juste (« cote mini ») et risque.
 */
import { pPlusDe, lambdaRestant } from "../poisson";
import type { Match } from "../types";
import { evaluerPlus15, evaluerPlus25, type Evaluation, type Verdict } from "./criteres";
import { fiabilite, type Fiabilite } from "./fiabilite";
import { butsAttendus } from "./modele";

export type MethodeAnalysee = "+1.5" | "+2.5";

export interface Analyse {
  ev: Evaluation;
  /** Verdict final, dégradé si les données sont trop incomplètes. */
  v: Verdict;
  /** Probabilité estimée que le pari gagne (NaN si inconnue). */
  p: number;
  /** Cote juste = 1/p : en dessous, le pari ne vaut pas le coup. */
  fair: number;
  /** Risque de 0 à 0,99 (combine probabilité et fiabilité). */
  risk: number;
  rel: Fiabilite;
}

/** Minute de référence de la méthode +1.5 : 0-0 à la 20e minute. */
export const MINUTE_REFERENCE_PLUS15 = 20;

export function analyser(m: Match, methode: MethodeAnalysee): Analyse {
  const ev = methode === "+1.5" ? evaluerPlus15(m) : evaluerPlus25(m);
  const rel = fiabilite(m);
  const l = butsAttendus(m);
  const p = Number.isFinite(l)
    ? methode === "+1.5"
      ? pPlusDe(lambdaRestant(l, MINUTE_REFERENCE_PLUS15), 1.5)
      : pPlusDe(l, 2.5)
    : NaN;
  const risk = Number.isFinite(p) ? Math.min(0.99, 1 - p * (0.5 + 0.5 * rel.f)) : NaN;
  let v = ev.v;
  if (rel.f < 0.5 && v === "ok") v = "mid";
  if (!Number.isFinite(p)) v = v === "ko" ? "ko" : "mid";
  return { ev, v, p, fair: 1 / p, risk, rel };
}

/** Niveau de risque de 1 à 5 (0 si inconnu). */
export function niveauRisque(r: number): number {
  return !Number.isFinite(r) ? 0 : r < 0.2 ? 1 : r < 0.35 ? 2 : r < 0.5 ? 3 : r < 0.65 ? 4 : 5;
}

export function motRisque(r: number): string {
  return !Number.isFinite(r) ? "inconnu" : r < 0.35 ? "faible" : r <= 0.5 ? "moyen" : "élevé";
}

export const LIBELLE_VERDICT: Readonly<Record<Verdict, string>> = { ok: "On joue", mid: "À revoir", ko: "On passe" };
export const ICONE_VERDICT: Readonly<Record<Verdict, string>> = { ok: "✅", mid: "⏳", ko: "❌" };
