/**
 * Offres de freebet : enregistrées avec les réglages de l'utilisateur (clé « offres »), donc incluses
 * dans ses sauvegardes et son historique de versions sans changer le format de la sauvegarde.
 */
import { completerOffres, type OffreFreebet } from "../core/offres";
import { reglage, type Contenu } from "./contenu";
import { ecrireReglage } from "./depot";

export function offresDe(c: Contenu): OffreFreebet[] {
  return completerOffres(reglage(c, "offres"));
}

export async function ecrireOffres(offres: readonly OffreFreebet[]): Promise<void> {
  await ecrireReglage("offres", offres);
}

export function nouvelIdOffre(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
