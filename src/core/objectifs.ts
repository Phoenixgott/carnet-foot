/**
 * Objectif et budget mensuel (phase 6) : suivi du mois en cours et alertes.
 * Un seul objectif/budget, reconduit chaque mois (pas d'historique par mois à régler).
 */
import { gainPari, parisTermines } from "./paris";
import type { Pari } from "./types";

export interface ReglagesObjectifs {
  /** Gain visé ce mois-ci, en euros (null : aucun objectif). */
  gainVise: number | null;
  /** Budget maximum misé ce mois-ci, en euros (null : aucun plafond). */
  budgetMax: number | null;
}

export const REGLAGES_OBJECTIFS_DEFAUT: ReglagesObjectifs = { gainVise: null, budgetMax: null };

/** Mois AAAA-MM d'une date AAAA-MM-JJ. */
export function moisDe(date: string): string {
  return date.slice(0, 7);
}

/** Nombre de jours du mois AAAA-MM. */
export function joursDansMois(mois: string): number {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export interface SuiviMois {
  mois: string;
  /** Paris terminés ce mois-ci. */
  nb: number;
  gains: number;
  miseEngagee: number;
  joursDansMois: number;
  joursEcoules: number;
  joursRestants: number;
  /** Gains ÷ objectif (NaN si aucun objectif réglé). */
  progression: number;
  objectifAtteint: boolean;
  /** Budget dépassé (avertissement doux, jamais un blocage). */
  budgetDepasse: boolean;
}

/** Suivi du mois donné (par défaut, le mois de `aujourdhui`). */
export function suiviMois(paris: readonly Pari[], reglages: ReglagesObjectifs, aujourdhui: string, mois = moisDe(aujourdhui)): SuiviMois {
  const duMois = parisTermines(paris).filter((p) => moisDe(p.date) === mois);
  const gains = duMois.reduce((s, p) => s + gainPari(p), 0);
  const miseEngagee = duMois.reduce((s, p) => s + (p.methode === "Freebet" ? 0 : p.mise), 0);
  const nbJours = joursDansMois(mois);
  const joursEcoules = mois === moisDe(aujourdhui) ? Number(aujourdhui.slice(8, 10)) : nbJours;
  return {
    mois,
    nb: duMois.length,
    gains,
    miseEngagee,
    joursDansMois: nbJours,
    joursEcoules,
    joursRestants: Math.max(nbJours - joursEcoules, 0),
    progression: reglages.gainVise ? gains / reglages.gainVise : NaN,
    objectifAtteint: reglages.gainVise !== null && gains >= reglages.gainVise,
    budgetDepasse: reglages.budgetMax !== null && miseEngagee > reglages.budgetMax,
  };
}

/** Réglages complets à partir de ce qui est enregistré. */
export function completerReglagesObjectifs(x: unknown): ReglagesObjectifs {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof ReglagesObjectifs, unknown>>;
  const nombreOuNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  return { gainVise: nombreOuNull(o.gainVise), budgetMax: nombreOuNull(o.budgetMax) };
}
