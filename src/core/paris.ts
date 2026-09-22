/**
 * Journal des paris : gains, bankroll et bilan (règles du carnet d'origine).
 *
 * - Gagné : mise × (cote − 1). Perdu : − mise. Sécurisé (« manuel ») : gain saisi.
 * - En cours et remboursé : 0, et ils ne comptent pas dans le bilan.
 * - Rentabilité (ROI) = gains ÷ mises engagées, sans les mises Freebet
 *   (un freebet n'est pas de l'argent réel misé).
 */
import type { Methode, Pari, ReglagesBankroll } from "./types";

/** Gain ou perte d'un pari (le `pnl` du carnet). */
export function gainPari(p: Pick<Pari, "statut" | "mise" | "cote" | "pnl">): number {
  if (p.statut === "gagne") return p.mise * (p.cote - 1);
  if (p.statut === "perdu") return -p.mise;
  if (p.statut === "manuel") return +(p.pnl as number) || 0;
  return 0;
}

/** Paris terminés : ni en cours ni remboursés. */
export function parisTermines<T extends Pick<Pari, "statut">>(paris: readonly T[]): T[] {
  return paris.filter((p) => p.statut !== "attente" && p.statut !== "rembourse");
}

export function gainsTotaux(paris: readonly Pari[]): number {
  return parisTermines(paris).reduce((s, p) => s + gainPari(p), 0);
}

export function bankrollCourante(paris: readonly Pari[], reglages: ReglagesBankroll): number {
  return reglages.depart + gainsTotaux(paris);
}

/** Mise conseillée : un pourcentage fixe de la bankroll courante. */
export function miseConseillee(paris: readonly Pari[], reglages: ReglagesBankroll): number {
  return (bankrollCourante(paris, reglages) * reglages.pctMise) / 100;
}

export interface Bilan {
  bankroll: number;
  gains: number;
  /** Gains ÷ mises engagées hors Freebet (NaN si aucune mise). */
  rentabilite: number;
  /** Part des paris terminés gagnants (NaN si aucun). */
  tauxReussite: number;
  nbTermines: number;
  parMethode: Array<{ methode: Methode; gains: number; nb: number }>;
}

const ORDRE_METHODES: Methode[] = ["+1.5", "Freebet", "+2.5", "Autre"];

export function bilan(paris: readonly Pari[], reglages: ReglagesBankroll): Bilan {
  const termines = parisTermines(paris);
  const gains = termines.reduce((s, p) => s + gainPari(p), 0);
  const engage = termines.reduce((s, p) => s + (p.methode === "Freebet" ? 0 : p.mise), 0);
  const gagnants = termines.filter((p) => gainPari(p) > 0).length;
  const parMethode = ORDRE_METHODES.map((methode) => {
    const d = termines.filter((p) => p.methode === methode);
    return { methode, gains: d.reduce((s, p) => s + gainPari(p), 0), nb: d.length };
  }).filter((x) => x.nb);
  return {
    bankroll: reglages.depart + gains,
    gains,
    rentabilite: engage ? gains / engage : NaN,
    tauxReussite: termines.length ? gagnants / termines.length : NaN,
    nbTermines: termines.length,
    parMethode,
  };
}

export const LIBELLE_STATUT: Readonly<Record<Pari["statut"], string>> = {
  attente: "En cours",
  gagne: "Gagné",
  perdu: "Perdu",
  manuel: "Sécurisé",
  rembourse: "Remboursé",
};
