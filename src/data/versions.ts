/**
 * Historique des versions : copies complètes du contenu, gardées dans l'application.
 * - une copie quotidienne automatique (les 30 dernières sont gardées) ;
 * - une copie avant chaque import ou restauration (les 15 dernières), pour pouvoir revenir en arrière.
 * Fonctions pures de décision ; l'écriture est faite par le dépôt.
 */
import type { Contenu, ResumeContenu } from "./contenu";

export type RaisonVersion = "quotidienne" | "avant-import" | "avant-modification" | "avant-restauration" | "avant-remise-a-zero" | "manuelle";

export interface Version {
  id: string;
  creeLe: string;
  /** Jour local (AAAA-MM-JJ) de création. */
  jour: string;
  raison: RaisonVersion;
  resume: ResumeContenu;
  contenu: Contenu;
}

export const GARDER_QUOTIDIENNES = 30;
export const GARDER_AUTRES = 15;

export const LIBELLE_RAISON: Readonly<Record<RaisonVersion, string>> = {
  quotidienne: "Copie du jour",
  "avant-import": "Avant un import",
  "avant-modification": "Avant une modification",
  "avant-restauration": "Avant une restauration",
  "avant-remise-a-zero": "Avant une remise à zéro",
  manuelle: "Copie manuelle",
};

/** Jour local au format AAAA-MM-JJ. */
export function jourLocal(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/** Faut-il créer la copie quotidienne ? Oui s'il n'y en a pas encore pour aujourd'hui. */
export function faireCopieDuJour(versions: ReadonlyArray<Pick<Version, "jour" | "raison">>, maintenant: Date): boolean {
  const j = jourLocal(maintenant);
  return !versions.some((v) => v.raison === "quotidienne" && v.jour === j);
}

/** Identifiants des versions trop anciennes à supprimer. */
export function versionsASupprimer(versions: ReadonlyArray<Pick<Version, "id" | "creeLe" | "raison">>): string[] {
  const recentes = [...versions].sort((a, b) => (a.creeLe < b.creeLe ? 1 : a.creeLe > b.creeLe ? -1 : 0));
  const quotidiennes = recentes.filter((v) => v.raison === "quotidienne");
  const autres = recentes.filter((v) => v.raison !== "quotidienne");
  return [...quotidiennes.slice(GARDER_QUOTIDIENNES), ...autres.slice(GARDER_AUTRES)].map((v) => v.id);
}
