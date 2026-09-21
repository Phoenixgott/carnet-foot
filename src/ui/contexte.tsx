/**
 * État partagé de l'interface : contenu chargé depuis la base, messages,
 * confirmations, état de la PWA.
 */
import { createContext, useContext } from "react";
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
}

export const ContexteAppli = createContext<Appli | null>(null);

export function useAppli(): Appli {
  const a = useContext(ContexteAppli);
  if (!a) throw new Error("ContexteAppli absent");
  return a;
}

export type Route = "accueil" | "matchs" | "paris" | "donnees" | "reglages";

export const ROUTES: ReadonlyArray<{ route: Route; libelle: string; titre: string }> = [
  { route: "accueil", libelle: "Accueil", titre: "Accueil" },
  { route: "matchs", libelle: "Matchs", titre: "Matchs" },
  { route: "paris", libelle: "Paris", titre: "Mes paris" },
  { route: "donnees", libelle: "Données", titre: "Mes données" },
  { route: "reglages", libelle: "Réglages", titre: "Réglages" },
];

export function lireRoute(): Route {
  const r = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return (ROUTES.find((x) => x.route === r)?.route ?? "accueil") as Route;
}

/** Nombre de jours entiers écoulés depuis une date. */
export function joursDepuis(d: Date, maintenant = new Date()): number {
  return Math.floor((maintenant.getTime() - d.getTime()) / 864e5);
}

export const RAPPEL_SAUVEGARDE_JOURS = 7;
