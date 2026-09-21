/**
 * État du live en cours (chronomètre, pari pris, couverture choisie).
 *
 * Gardé dans les réglages de l'appareil (clé « live ») pour survivre à la fermeture de l'application
 * pendant un match. Réglage local : ni sauvegardé dans le fichier, ni remplacé par une restauration.
 * Le chronomètre garde l'heure du coup d'envoi (pas un compteur) : la minute se recalcule toujours
 * juste, même après un écran éteint.
 */
import type { ModeCouverture } from "../core/modele-v2/live";
import { lireReglage, ecrireReglage } from "./depot";

export type PhaseLive = "avant" | "en-jeu" | "but";

export interface EtatLive {
  /** Match suivi (id) ; null : buts attendus saisis à la main. */
  matchId: string | null;
  /** Buts attendus saisis à la main (texte, virgule acceptée), sans match. */
  butsAttendusSaisis: string;
  /** Heure du coup d'envoi (ms, comme Date.now()) ; null : chronomètre arrêté. */
  coupEnvoiLe: number | null;
  /** Minute réglée à la main quand le chronomètre est arrêté. */
  minuteManuelle: number;
  phase: PhaseLive;
  /** Pari pris : cote, mise et minute d'entrée. */
  cote: number | null;
  mise: number | null;
  minuteEntree: number | null;
  /** Minute du premier but. */
  minuteBut: number | null;
  modeCouverture: ModeCouverture;
  /** Commission de l'exchange, en %. */
  commission: number;
}

export const ETAT_LIVE_VIDE: EtatLive = {
  matchId: null,
  butsAttendusSaisis: "2,7",
  coupEnvoiLe: null,
  minuteManuelle: 15,
  phase: "avant",
  cote: null,
  mise: null,
  minuteEntree: null,
  minuteBut: null,
  modeCouverture: "contre",
  commission: 5,
};

const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** État complet à partir de ce qui est enregistré : ce qui manque ou est faux prend la valeur par défaut. */
export function completerEtatLive(x: unknown): EtatLive {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const phase: PhaseLive = o.phase === "en-jeu" || o.phase === "but" ? o.phase : "avant";
  const mode: ModeCouverture = o.modeCouverture === "lay" || o.modeCouverture === "cash" ? o.modeCouverture : "contre";
  const e: EtatLive = {
    matchId: typeof o.matchId === "string" ? o.matchId : null,
    butsAttendusSaisis: typeof o.butsAttendusSaisis === "string" ? o.butsAttendusSaisis : ETAT_LIVE_VIDE.butsAttendusSaisis,
    coupEnvoiLe: nombre(o.coupEnvoiLe),
    minuteManuelle: Math.min(Math.max(nombre(o.minuteManuelle) ?? ETAT_LIVE_VIDE.minuteManuelle, 0), 120),
    phase,
    cote: nombre(o.cote),
    mise: nombre(o.mise),
    minuteEntree: nombre(o.minuteEntree),
    minuteBut: nombre(o.minuteBut),
    modeCouverture: mode,
    commission: Math.min(Math.max(nombre(o.commission) ?? ETAT_LIVE_VIDE.commission, 0), 30),
  };
  // Un pari en jeu sans cote ou sans mise n'a pas de sens : retour au départ
  if (e.phase !== "avant" && (e.cote === null || e.mise === null)) return { ...e, phase: "avant", cote: null, mise: null, minuteEntree: null, minuteBut: null };
  if (e.phase === "but" && e.minuteBut === null) return { ...e, phase: "en-jeu" };
  return e;
}

/** Minute écoulée depuis le coup d'envoi (entier) et secondes dans la minute ; null si le chronomètre est arrêté. */
export function tempsEcoule(coupEnvoiLe: number | null, maintenant: number): { minute: number; secondes: number } | null {
  if (coupEnvoiLe === null) return null;
  const s = Math.max(Math.floor((maintenant - coupEnvoiLe) / 1000), 0);
  return { minute: Math.floor(s / 60), secondes: s % 60 };
}

export async function lireEtatLive(): Promise<EtatLive> {
  return completerEtatLive(await lireReglage("live"));
}

export async function ecrireEtatLive(e: EtatLive): Promise<void> {
  await ecrireReglage("live", e);
}
