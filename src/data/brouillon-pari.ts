/**
 * Passerelle « Noter ce pari » : le Live et le Freebet préparent un pari à moitié rempli,
 * l'onglet Paris le propose à l'ouverture du formulaire d'ajout. Réglage local (jamais dans la
 * sauvegarde) : c'est un brouillon de saisie, pas une donnée à conserver.
 */
import type { Methode, StatutPari } from "../core/types";
import { ecrireReglage, lireReglage } from "./depot";

export interface BrouillonPari {
  date: string;
  match: string;
  methode: Methode;
  cote: number | null;
  mise: number | null;
  statut: StatutPari;
  pnl?: number;
  notes?: string;
  ligue?: string | null;
  matchId?: string | null;
}

export async function deposerBrouillonPari(b: BrouillonPari): Promise<void> {
  await ecrireReglage("brouillonPari", b);
}

/** Lit le brouillon et le retire aussitôt : il ne sert qu'une fois. */
export async function retirerBrouillonPari(): Promise<BrouillonPari | null> {
  const b = await lireReglage<BrouillonPari>("brouillonPari");
  if (b) await ecrireReglage("brouillonPari", null);
  return b ?? null;
}
