/**
 * Bilan hebdomadaire (phase 8) : résumé simple de la semaine en cours (lundi à dimanche),
 * comparé à la semaine précédente, pour se relire vite sans ouvrir les statistiques complètes.
 */
import { gainPari, parisTermines } from "./paris";
import type { Pari } from "./types";

function ajouterJours(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine (AAAA-MM-JJ) contenant cette date. */
export function debutSemaine(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  const jour = (d.getUTCDay() + 6) % 7; // 0 = lundi … 6 = dimanche
  return ajouterJours(date, -jour);
}

export function finSemaine(debut: string): string {
  return ajouterJours(debut, 6);
}

interface MethodeGains {
  methode: string;
  gains: number;
}

export interface BilanSemaine {
  debut: string;
  fin: string;
  nb: number;
  gains: number;
  mise: number;
  /** NaN si aucun pari terminé cette semaine-là. */
  tauxReussite: number;
  meilleureMethode: MethodeGains | null;
  pireMethode: MethodeGains | null;
}

function bilanEntre(paris: readonly Pari[], debut: string, fin: string): BilanSemaine {
  const ps = parisTermines(paris).filter((p) => p.date >= debut && p.date <= fin);
  const gains = ps.reduce((s, p) => s + gainPari(p), 0);
  const mise = ps.reduce((s, p) => s + (p.methode === "Freebet" ? 0 : p.mise), 0);
  const gagnants = ps.filter((p) => gainPari(p) > 0).length;
  const parMethode = new Map<string, number>();
  for (const p of ps) parMethode.set(p.methode, (parMethode.get(p.methode) ?? 0) + gainPari(p));
  const entrees = [...parMethode.entries()].map(([methode, g]) => ({ methode, gains: g }));
  const meilleureMethode = entrees.length ? entrees.reduce((a, b) => (b.gains > a.gains ? b : a)) : null;
  const pireMethode = entrees.length > 1 ? entrees.reduce((a, b) => (b.gains < a.gains ? b : a)) : null;
  return { debut, fin, nb: ps.length, gains, mise, tauxReussite: ps.length ? gagnants / ps.length : NaN, meilleureMethode, pireMethode };
}

export interface BilanHebdo {
  cetteSemaine: BilanSemaine;
  semainePrecedente: BilanSemaine;
}

/** Bilan de la semaine en cours et de la précédente, d'après la date du jour. */
export function bilanHebdomadaire(paris: readonly Pari[], aujourdhui: string): BilanHebdo {
  const debut = debutSemaine(aujourdhui);
  const fin = finSemaine(debut);
  const debutPrec = ajouterJours(debut, -7);
  const finPrec = ajouterJours(fin, -7);
  return { cetteSemaine: bilanEntre(paris, debut, fin), semainePrecedente: bilanEntre(paris, debutPrec, finPrec) };
}
