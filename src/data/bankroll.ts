/**
 * Réglages de mises et d'objectifs de l'utilisateur (phase 6), enregistrés avec ses autres
 * réglages (clés « mises » et « objectifs »), donc inclus dans sa sauvegarde.
 */
import { completerReglagesMises, type ReglagesMises } from "../core/mises";
import { completerReglagesObjectifs, type ReglagesObjectifs } from "../core/objectifs";
import { reglage, type Contenu } from "./contenu";

export function reglagesMisesDe(c: Contenu): ReglagesMises {
  return completerReglagesMises(reglage(c, "mises"));
}

export function reglagesObjectifsDe(c: Contenu): ReglagesObjectifs {
  return completerReglagesObjectifs(reglage(c, "objectifs"));
}
