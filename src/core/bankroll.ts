/**
 * Statistiques avancées de bankroll (phase 6) : courbe, drawdown maximal, séries en cours,
 * ROI et taux de réussite ventilés par méthode, compétition, jour de la semaine et tranche de cote.
 * Fonctions pures sur le journal des paris.
 */
import { gainPari, parisTermines } from "./paris";
import type { Pari, ReglagesBankroll } from "./types";

/* ------------------------------------------------------------------ */
/* Courbe et drawdown                                                  */

export interface PointCourbe {
  /** Position dans le journal (0 = bankroll de départ, avant tout pari). */
  n: number;
  pariId: string | null;
  date: string;
  bankroll: number;
}

/** Bankroll après chaque pari terminé, dans l'ordre du journal (le point 0 est la bankroll de départ). */
export function courbeBankroll(paris: readonly Pari[], reglages: ReglagesBankroll): PointCourbe[] {
  const termines = [...parisTermines(paris)].sort((a, b) => a.ordre - b.ordre);
  const courbe: PointCourbe[] = [{ n: 0, pariId: null, date: "", bankroll: reglages.depart }];
  let bankroll = reglages.depart;
  termines.forEach((p, i) => {
    bankroll += gainPari(p);
    courbe.push({ n: i + 1, pariId: p.id, date: p.date, bankroll });
  });
  return courbe;
}

export interface Drawdown {
  /** Perte maximale depuis un sommet, en euros (0 si la bankroll n'a jamais baissé). */
  montant: number;
  /** La même, en % du sommet atteint avant la baisse (NaN si le sommet est à 0). */
  pct: number;
  /** Point du sommet et point le plus bas de cette baisse (index dans la courbe). */
  duSommet: number;
  auCreux: number;
}

/** Plus grande baisse entre un sommet et un creux qui le suit, sur la courbe de bankroll. */
export function drawdownMax(courbe: readonly PointCourbe[]): Drawdown {
  let sommet = courbe[0]?.bankroll ?? 0;
  let indexSommet = 0;
  let pire: Drawdown = { montant: 0, pct: 0, duSommet: 0, auCreux: 0 };
  courbe.forEach((pt, i) => {
    if (pt.bankroll > sommet) {
      sommet = pt.bankroll;
      indexSommet = i;
    }
    const baisse = sommet - pt.bankroll;
    if (baisse > pire.montant) pire = { montant: baisse, pct: sommet > 0 ? baisse / sommet : NaN, duSommet: indexSommet, auCreux: i };
  });
  return pire;
}

/* ------------------------------------------------------------------ */
/* Séries de victoires et défaites                                     */

export type IssuePari = "victoire" | "defaite" | "neutre";

/** Victoire = gain strictement positif (couvre aussi un « manuel » gagnant) ; défaite = gain négatif ; neutre = 0 (rare : lay parfait, remboursé compté ailleurs). */
export function issue(p: Pari): IssuePari {
  const g = gainPari(p);
  return g > 0 ? "victoire" : g < 0 ? "defaite" : "neutre";
}

export interface Serie {
  type: IssuePari;
  longueur: number;
}

export interface Series {
  /** Série en cours, à partir du pari le plus récent (peut être « neutre » ou longueur 0 si aucune). */
  actuelle: Serie;
  meilleureVictoires: number;
  pireDefaites: number;
}

/** Séries de victoires/défaites consécutives, dans l'ordre chronologique du journal. */
export function series(paris: readonly Pari[]): Series {
  const termines = [...parisTermines(paris)].sort((a, b) => a.ordre - b.ordre).map(issue);
  let meilleureVictoires = 0;
  let pireDefaites = 0;
  let courante: IssuePari | null = null;
  let longueur = 0;
  for (const x of termines) {
    if (x === courante) longueur++;
    else {
      courante = x;
      longueur = 1;
    }
    if (x === "victoire") meilleureVictoires = Math.max(meilleureVictoires, longueur);
    if (x === "defaite") pireDefaites = Math.max(pireDefaites, longueur);
  }
  const actuelle: Serie = courante ? { type: courante, longueur } : { type: "neutre", longueur: 0 };
  return { actuelle, meilleureVictoires, pireDefaites };
}

/* ------------------------------------------------------------------ */
/* Ventilations                                                        */

export interface Ventilation<T> {
  cle: T;
  libelle: string;
  nb: number;
  gains: number;
  mise: number;
  /** Gains ÷ mise engagée, hors Freebet (NaN si aucune mise). */
  roi: number;
  /** Part de paris gagnants (NaN si aucun terminé). */
  tauxReussite: number;
}

/** Ventile les paris terminés selon une clé quelconque (méthode, jour, tranche de cote…). */
export function ventiler<T>(paris: readonly Pari[], cleDe: (p: Pari) => T, libelleDe: (cle: T) => string): Array<Ventilation<T>> {
  const groupes = new Map<string, { cle: T; paris: Pari[] }>();
  for (const p of parisTermines(paris)) {
    const cle = cleDe(p);
    const k = JSON.stringify(cle);
    if (!groupes.has(k)) groupes.set(k, { cle, paris: [] });
    groupes.get(k)!.paris.push(p);
  }
  return [...groupes.values()].map(({ cle, paris: ps }) => {
    const gains = ps.reduce((s, p) => s + gainPari(p), 0);
    const mise = ps.reduce((s, p) => s + (p.methode === "Freebet" ? 0 : p.mise), 0);
    const gagnants = ps.filter((p) => gainPari(p) > 0).length;
    return { cle, libelle: libelleDe(cle), nb: ps.length, gains, mise, roi: mise ? gains / mise : NaN, tauxReussite: gagnants / ps.length };
  });
}

export function parMethode(paris: readonly Pari[]) {
  return ventiler(paris, (p) => p.methode, (m) => m).sort((a, b) => b.nb - a.nb);
}

export function parCompetition(paris: readonly Pari[]) {
  return ventiler(paris, (p) => p.ligue || null, (c) => c ?? "Compétition inconnue").sort((a, b) => b.nb - a.nb);
}

const JOURS_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Jour de la semaine d'une date AAAA-MM-JJ ; null si illisible. */
export function jourSemaine(date: string): string | null {
  const d = new Date(date + "T12:00:00Z");
  return Number.isNaN(d.getTime()) ? null : JOURS_SEMAINE[d.getUTCDay()];
}

const ORDRE_JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const rangJour = (j: string | null) => (j === null ? ORDRE_JOURS.length : ORDRE_JOURS.indexOf(j));

export function parJourSemaine(paris: readonly Pari[]) {
  return ventiler(paris, (p) => jourSemaine(p.date), (j) => (j ? j.charAt(0).toUpperCase() + j.slice(1) : "Jour inconnu")).sort(
    (a, b) => rangJour(a.cle) - rangJour(b.cle),
  );
}

export interface TrancheCote {
  min: number;
  max: number;
  libelle: string;
}

/** Tranches de cote (la borne haute est exclue, sauf la dernière). */
export const TRANCHES_COTE: readonly TrancheCote[] = [
  { min: 1, max: 1.5, libelle: "moins de 1,5" },
  { min: 1.5, max: 2, libelle: "1,5 à 2" },
  { min: 2, max: 3, libelle: "2 à 3" },
  { min: 3, max: 5, libelle: "3 à 5" },
  { min: 5, max: Infinity, libelle: "5 et plus" },
];

export function trancheDe(cote: number): TrancheCote | null {
  return TRANCHES_COTE.find((t) => cote >= t.min && (cote < t.max || t.max === Infinity)) ?? null;
}

export function parTrancheCote(paris: readonly Pari[]) {
  return ventiler(paris, (p) => trancheDe(p.cote)?.libelle ?? null, (l) => l ?? "Cote inconnue").sort((a, b) => {
    const ia = TRANCHES_COTE.findIndex((t) => t.libelle === a.libelle);
    const ib = TRANCHES_COTE.findIndex((t) => t.libelle === b.libelle);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}
