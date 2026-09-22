/**
 * « Contenu » : l'ensemble des données de l'utilisateur, tel qu'il est
 * sauvegardé, restauré et versionné. Fonctions pures, testées sans navigateur.
 */
import { bankrollCourante, gainsTotaux } from "../core/paris";
import type { Match, Pari, Reglage, ReglagesBankroll } from "../core/types";

export interface Contenu {
  matchs: Match[];
  paris: Pari[];
  reglages: Reglage[];
}

/** Réglages propres à cet appareil : jamais inclus dans une sauvegarde ni écrasés par une restauration. */
export const REGLAGES_LOCAUX: readonly string[] = ["dernierExportFichier", "live", "rappelOffresLe", "brouillonPari"];

export const BANKROLL_PAR_DEFAUT: ReglagesBankroll = { depart: 200, pctMise: 2 };

export function contenuVide(): Contenu {
  return { matchs: [], paris: [], reglages: [] };
}

export function estVide(c: Contenu): boolean {
  return c.matchs.length === 0 && c.paris.length === 0;
}

export function reglage<T>(c: Contenu, cle: string): T | undefined {
  return c.reglages.find((r) => r.cle === cle)?.valeur as T | undefined;
}

export function bankrollDe(c: Contenu): ReglagesBankroll {
  return reglage<ReglagesBankroll>(c, "bankroll") ?? BANKROLL_PAR_DEFAUT;
}

/** Contenu sans les réglages propres à l'appareil. */
export function sansReglagesLocaux(c: Contenu): Contenu {
  return { ...c, reglages: c.reglages.filter((r) => !REGLAGES_LOCAUX.includes(r.cle)) };
}

/** Ordre stable : matchs par id, paris par ordre de saisie, réglages par clé. */
export function trierContenu(c: Contenu): Contenu {
  return {
    matchs: [...c.matchs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    paris: [...c.paris].sort((a, b) => a.ordre - b.ordre),
    reglages: [...c.reglages].sort((a, b) => (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0)),
  };
}

export interface ResumeContenu {
  nbMatchs: number;
  nbParis: number;
  bankroll: number;
  gainsTotal: number;
}

export function resumer(c: Contenu): ResumeContenu {
  const b = bankrollDe(c);
  return {
    nbMatchs: c.matchs.length,
    nbParis: c.paris.length,
    bankroll: bankrollCourante(c.paris, b),
    gainsTotal: gainsTotaux(c.paris),
  };
}

/**
 * JSON canonique : clés triées, pour comparer deux contenus
 * ou calculer une empreinte indépendamment de l'ordre des champs.
 */
export function jsonCanonique(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>((o, k) => {
          o[k] = (val as Record<string, unknown>)[k];
          return o;
        }, {});
    }
    return val;
  });
}

/** Empreinte SHA-256 (hexadécimal) du contenu trié : détecte un fichier abîmé ou tronqué. */
export async function empreinte(c: Contenu): Promise<string> {
  const octets = new TextEncoder().encode(jsonCanonique(trierContenu(sansReglagesLocaux(c))));
  const hash = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
