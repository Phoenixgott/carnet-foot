/**
 * Jeu responsable (phase 8) : rappel doux quand une série de défaites ou le plafond du jour est
 * atteint, et pause (auto-exclusion) temporaire que l'utilisateur règle et retire lui-même.
 * Rien n'est envoyé nulle part : ce sont des garde-fous purement locaux, choisis par lui.
 */
import { series } from "./bankroll";
import { eur } from "./format";
import { miseEngageeCeJour } from "./mises";
import type { Pari } from "./types";

export interface ReglagesJeuResponsable {
  /** Rappel proposé après ce nombre de défaites d'affilée (null : désactivé). */
  rappelApresDefaites: number | null;
  /** Rappel proposé si la mise engagée d'un jour dépasse ce montant, en euros (null : désactivé). */
  rappelApresPlafondJour: number | null;
  /** Durée par défaut d'une pause déclenchée depuis le rappel, en heures. */
  dureePauseHeures: number;
}

export const REGLAGES_JEU_RESPONSABLE_DEFAUT: ReglagesJeuResponsable = {
  rappelApresDefaites: null,
  rappelApresPlafondJour: null,
  dureePauseHeures: 24,
};

/** Réglages complets à partir de ce qui est enregistré : valeurs manquantes ou fausses → défaut. */
export function completerReglagesJeuResponsable(x: unknown): ReglagesJeuResponsable {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof ReglagesJeuResponsable, unknown>>;
  const entierOuNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.round(v) : null);
  const montantOuNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  return {
    rappelApresDefaites: entierOuNull(o.rappelApresDefaites),
    rappelApresPlafondJour: montantOuNull(o.rappelApresPlafondJour),
    dureePauseHeures: typeof o.dureePauseHeures === "number" && o.dureePauseHeures > 0 ? o.dureePauseHeures : REGLAGES_JEU_RESPONSABLE_DEFAUT.dureePauseHeures,
  };
}

export interface RappelPause {
  raison: "defaites" | "plafond-jour";
  texte: string;
}

/** Un rappel doit-il s'afficher maintenant ? Jamais un blocage à lui seul (voir AutoExclusion plus bas). */
export function rappelPause(paris: readonly Pari[], reglages: ReglagesJeuResponsable, aujourdhui: string): RappelPause | null {
  if (reglages.rappelApresDefaites !== null) {
    const s = series(paris).actuelle;
    if (s.type === "defaite" && s.longueur >= reglages.rappelApresDefaites) {
      return { raison: "defaites", texte: `${s.longueur} défaites d'affilée. Une pause peut aider à garder la tête froide.` };
    }
  }
  if (reglages.rappelApresPlafondJour !== null) {
    const engage = miseEngageeCeJour(paris, aujourdhui);
    if (engage > reglages.rappelApresPlafondJour) {
      return { raison: "plafond-jour", texte: `${eur(engage)} misés aujourd'hui, au-delà du plafond que tu t'es fixé.` };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Pause (auto-exclusion)                                              */

export interface AutoExclusion {
  debut: string;
  fin: string;
  /** Raison au moment du déclenchement (facultative, juste pour se souvenir pourquoi). */
  raison: string | null;
}

export function demarrerPause(heures: number, maintenant: Date, raison: string | null = null): AutoExclusion {
  return { debut: maintenant.toISOString(), fin: new Date(maintenant.getTime() + heures * 3_600_000).toISOString(), raison };
}

export function pauseActive(a: AutoExclusion | null | undefined, maintenant: Date): a is AutoExclusion {
  return !!a && new Date(a.fin).getTime() > maintenant.getTime();
}

/** Temps restant, en secondes entières (0 si terminée, absente, ou date illisible). */
export function secondesRestantes(a: AutoExclusion | null | undefined, maintenant: Date): number {
  if (!pauseActive(a, maintenant)) return 0;
  return Math.max(0, Math.round((new Date(a.fin).getTime() - maintenant.getTime()) / 1000));
}

/** Texte lisible d'une durée en secondes (« 3 h 12 », « 45 min »). */
export function dureeLisible(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const min = Math.floor((secondes % 3600) / 60);
  if (h > 0) return min > 0 ? `${h} h ${min} min` : `${h} h`;
  return `${Math.max(1, min)} min`;
}
