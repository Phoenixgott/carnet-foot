/**
 * Fiabilité d'un match : quelles données on a, sur 8 (carnet d'origine, repris à l'identique).
 *
 * Les 8 infos et leur poids (total 100) :
 *  - buts marqués/encaissés (25), % de matchs à 2+ buts (12), % de matchs à 3+ buts (12),
 *    derniers matchs (15) : à renseigner pour les deux équipes, demi-point si une seule ;
 *  - moyenne de buts de la compétition (8), confrontations directes (10) ;
 *  - absents/blessés (10) et cotes (8) : publiés tard, normal de les attendre avant le jour J.
 */
import { estNombre } from "../format";
import type { Equipe, Match } from "../types";

export interface InfoFiabilite {
  /** Poids de l'info dans le score. */
  w: number;
  /** Vrai si l'info est complète. */
  ok: boolean;
  /** Part obtenue : 1, 0,5 (une seule équipe renseignée) ou 0. */
  part: number;
  label: string;
  /** Vrai pour les infos publiées tard (absents, cotes). */
  later: boolean;
}

export interface Fiabilite {
  /** Score pondéré de 0 à 1. */
  f: number;
  items: InfoFiabilite[];
  missing: InfoFiabilite[];
}

export function fiabilite(m: Match): Fiabilite {
  const h: Equipe = m.domicile || {};
  const a: Equipe = m.exterieur || {};
  const equipes = [h, a];
  const items: InfoFiabilite[] = [];

  const parEquipe = (w: number, label: string, test: (t: Equipe) => boolean) => {
    const manque = equipes.filter((t) => !test(t));
    items.push({
      w,
      ok: !manque.length,
      part: manque.length === 1 ? 0.5 : manque.length ? 0 : 1,
      label: label + (manque.length ? " (" + manque.map((t) => t.nom || "?").join(", ") + ")" : ""),
      later: false,
    });
  };
  parEquipe(25, "buts marqués/encaissés", (t) => estNombre(t.joues) && estNombre(t.marques) && estNombre(t.encaisses));
  parEquipe(12, "% de matchs à 2+ buts", (t) => estNombre(t.pctOver15));
  parEquipe(12, "% de matchs à 3+ buts", (t) => estNombre(t.pctOver25));
  parEquipe(
    15,
    "derniers matchs",
    (t) => Array.isArray(t.derniersButsMarques) && t.derniersButsMarques.filter(estNombre).length >= 3,
  );

  const unique = (w: number, label: string, ok: boolean, later: boolean) =>
    items.push({ w, ok, part: ok ? 1 : 0, label, later });
  unique(8, "moyenne de buts de la compétition", estNombre(m.moyenneButsLigue), false);
  unique(10, "confrontations directes", !!(m.h2h && estNombre(m.h2h.joues) && estNombre(m.h2h.over25)), false);
  unique(10, "absents / blessés", Array.isArray(m.absents), true);
  unique(8, "cotes", !!(m.cotes && (estNombre(m.cotes.over15) || estNombre(m.cotes.over25))), true);

  const f = items.reduce((s, x) => s + x.w * x.part, 0) / items.reduce((s, x) => s + x.w, 0);
  return { f, items, missing: items.filter((x) => !x.ok) };
}

/** Libellés des infos manquantes (le `missingOf` du carnet). */
export function infosManquantes(m: Match): string[] {
  return fiabilite(m).missing.map((x) => x.label);
}

/** Nombre d'infos complètes sur 8. */
export function nombreInfos(f: Fiabilite): number {
  return f.items.filter((x) => x.ok).length;
}
