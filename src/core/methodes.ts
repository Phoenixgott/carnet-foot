import type { Methode } from "./types";

/**
 * Les méthodes et leurs noms exacts. Ne jamais les renommer.
 * Seules +1.5 et +2.5 sont proposées dans l'application (le Freebet a été retiré à la demande de
 * l'utilisateur) ; « Freebet » et « Autre » restent connus pour lire les anciens paris.
 */
export const METHODES: ReadonlyArray<{
  nom: Methode;
  libelle: string;
  resume: string;
}> = [
  {
    nom: "+1.5",
    libelle: "Méthode +1.5",
    resume: "Pendant le match : s'il n'y a toujours pas de but vers la 15ᵉ-20ᵉ minute, on parie qu'il y aura au moins 2 buts.",
  },
  {
    nom: "+2.5",
    libelle: "Méthode +2.5",
    resume: "Avant le match : on parie qu'il y aura au moins 3 buts, sur les matchs que l'app conseille.",
  },
  { nom: "Freebet", libelle: "Freebet (ancien)", resume: "Ancienne méthode, plus proposée." },
  { nom: "Autre", libelle: "Autre", resume: "Pari hors méthode." },
];

/** Les deux méthodes proposées pour un nouveau pari. */
export const METHODES_JOUABLES: readonly Methode[] = ["+1.5", "+2.5"];

/**
 * Codes internes du carnet d'origine. Attention au croisement :
 * m1 = +1.5, m3 = +2.5, m2 = Freebet.
 */
export const CODE_CARNET_VERS_METHODE: Readonly<Record<string, Methode>> = {
  m1: "+1.5",
  m3: "+2.5",
  m2: "Freebet",
  autre: "Autre",
};

export function libelleMethode(m: Methode): string {
  return METHODES.find((x) => x.nom === m)?.libelle ?? m;
}
