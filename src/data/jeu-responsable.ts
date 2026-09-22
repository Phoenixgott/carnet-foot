/**
 * Réglages de jeu responsable et pause active (phase 8), enregistrés avec les autres réglages
 * (clés « jeuResponsable » et « pause »), donc inclus dans la sauvegarde : une pause posée reste
 * posée même après une restauration ou un changement d'appareil.
 */
import { completerReglagesJeuResponsable, type AutoExclusion, type ReglagesJeuResponsable } from "../core/jeu-responsable";
import { reglage, type Contenu } from "./contenu";

export function reglagesJeuResponsableDe(c: Contenu): ReglagesJeuResponsable {
  return completerReglagesJeuResponsable(reglage(c, "jeuResponsable"));
}

export function pauseDe(c: Contenu): AutoExclusion | null {
  return reglage<AutoExclusion>(c, "pause") ?? null;
}
