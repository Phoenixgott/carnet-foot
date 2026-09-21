import type { Methode } from "./types";

/**
 * Les trois méthodes et leurs noms exacts. Ne jamais les renommer.
 * `garantie` : seul le Freebet est garanti mathématiquement.
 */
export const METHODES: ReadonlyArray<{
  nom: Methode;
  libelle: string;
  resume: string;
  garantie: boolean;
}> = [
  {
    nom: "+1.5",
    libelle: "Méthode +1.5",
    resume: "Pari live à 0-0 vers la 15e-20e minute, puis couverture après le premier but.",
    garantie: false,
  },
  {
    nom: "+2.5",
    libelle: "Méthode +2.5",
    resume: "Pari avant-match selon des critères d'équipes et de championnat.",
    garantie: false,
  },
  {
    nom: "Freebet",
    libelle: "Méthode Freebet",
    resume: "Match betting : profit garanti par couverture chez un autre bookmaker.",
    garantie: true,
  },
  { nom: "Autre", libelle: "Autre", resume: "Pari hors méthode.", garantie: false },
];

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
