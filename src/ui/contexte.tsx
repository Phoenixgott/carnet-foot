/**
 * État partagé de l'interface : contenu chargé depuis la base, messages,
 * confirmations, état de la PWA.
 */
import { createContext, useContext } from "react";
import type { ContexteDe } from "../core/cotes";
import type { Resultat } from "../core/types";
import type { Contenu } from "../data/contenu";
import type { EtatPwa } from "../pwa/pwa";

export interface OptionsConfirmation {
  titre: string;
  texte: string;
  action: string;
  danger?: boolean;
}

export interface Appli {
  contenu: Contenu;
  recharger: () => Promise<void>;
  message: (texte: string) => void;
  confirmer: (o: OptionsConfirmation) => Promise<boolean>;
  pwa: EtatPwa;
  dernierExport: Date | null;
  /** Historiques CSV (résultats passés). */
  resultats: Resultat[];
  rechargerResultats: () => Promise<void>;
  /** Contexte d'analyse de chaque match (réglages, chiffres de son championnat). */
  contexteDe: ContexteDe;
}

export const ContexteAppli = createContext<Appli | null>(null);

export function useAppli(): Appli {
  const a = useContext(ContexteAppli);
  if (!a) throw new Error("ContexteAppli absent");
  return a;
}

export type Route = "accueil" | "matchs" | "live" | "paris" | "donnees" | "reglages" | "equipe";

export const ROUTES: ReadonlyArray<{ route: Route; libelle: string; titre: string }> = [
  { route: "accueil", libelle: "Accueil", titre: "Accueil" },
  { route: "matchs", libelle: "Matchs", titre: "Matchs" },
  { route: "live", libelle: "Live", titre: "Live +1.5" },
  { route: "paris", libelle: "Paris", titre: "Mes paris" },
  { route: "donnees", libelle: "Données", titre: "Mes données" },
  { route: "reglages", libelle: "Réglages", titre: "Réglages" },
];

export function lireRoute(): Route {
  const r = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  if (r === "equipe") return "equipe";
  return (ROUTES.find((x) => x.route === r)?.route ?? "accueil") as Route;
}

/** Paramètres de l'adresse (« #/equipe?nom=Lens&contre=Brest »). */
export function parametresRoute(): URLSearchParams {
  const h = window.location.hash;
  const i = h.indexOf("?");
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : "");
}

/** Adresse de l'écran live pour un match. */
export function lienLive(matchId: string): string {
  return "#/live?" + new URLSearchParams({ match: matchId }).toString();
}

/** Adresse de la fiche d'une équipe. */
export function lienEquipe(nom: string, contre?: string | null): string {
  const p = new URLSearchParams({ nom });
  if (contre) p.set("contre", contre);
  return "#/equipe?" + p.toString();
}

/** Nombre de jours entiers écoulés depuis une date. */
export function joursDepuis(d: Date, maintenant = new Date()): number {
  return Math.floor((maintenant.getTime() - d.getTime()) / 864e5);
}

export const RAPPEL_SAUVEGARDE_JOURS = 7;
