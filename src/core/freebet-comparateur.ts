/**
 * Comparateur : quel match choisir pour utiliser un freebet ?
 *
 * Pour chaque match qui a les cotes « plus de » et « moins de » d'une même ligne (1,5 ou 2,5 buts),
 * on simule le freebet sur un côté et sa couverture sur l'autre, et on classe par taux de conversion
 * (part du freebet transformée en argent réel).
 *
 * Limite honnête : un match n'a qu'un seul jeu de cotes (un bookmaker). Le pari inverse est donc
 * supposé à la cote du même bookmaker ; chez un autre site, la cote inverse peut être meilleure.
 * Le classement sert à choisir le match ; le calculateur (avec les vraies cotes des deux sites)
 * donne le chiffre final.
 */
import { estNombre } from "./format";
import { margeBookmaker } from "./marge";
import { jambeFreebet, type ModeCouverture } from "./freebet";
import type { Match } from "./types";

export type LigneButs = "1.5" | "2.5";
export type Cote = "plus" | "moins";

export interface OptionsComparateur {
  montant: number;
  rembourse: boolean;
  mode: ModeCouverture;
  /** Commission de l'exchange en fraction (0,05) ; ignorée en mode « book ». */
  commission: number;
  /** Cote minimale exigée par l'offre pour le freebet ; null si aucune. */
  coteMin: number | null;
  /** Jour à partir duquel on regarde (AAAA-MM-JJ) : les matchs passés sont ignorés. */
  aPartirDu: string;
}

export interface Candidat {
  matchId: string;
  match: string;
  date: string | null;
  heure: string | null;
  ligue: string | null;
  bookmaker: string | null;
  ligne: LigneButs;
  /** Côté sur lequel on place le freebet. */
  cote: Cote;
  /** Cote du freebet et cote de sa couverture (côté opposé). */
  coteFreebet: number;
  coteInverse: number;
  /** Marge du bookmaker sur cette ligne. */
  marge: number;
  miseCouverture: number;
  /** Gain garanti sur le freebet. */
  gain: number;
  /** Gain ÷ montant du freebet. */
  conversion: number;
}

export interface ResultatComparateur {
  candidats: Candidat[];
  /** Matchs à venir sans les deux cotes d'une même ligne : impossible à évaluer. */
  sansCotes: number;
  /** Combinaisons écartées car la cote du freebet est sous la cote minimale de l'offre. */
  ecartees: number;
}

const LIBELLE: Readonly<Record<Cote, string>> = { plus: "plus de", moins: "moins de" };

export function libelleCandidat(c: Pick<Candidat, "cote" | "ligne">): string {
  return `${LIBELLE[c.cote]} ${c.ligne.replace(".", ",")} buts`;
}

export function comparerFreebet(matchs: readonly Match[], o: OptionsComparateur): ResultatComparateur {
  const candidats: Candidat[] = [];
  let sansCotes = 0;
  let ecartees = 0;
  if (!(o.montant > 0)) return { candidats, sansCotes, ecartees };
  for (const m of matchs) {
    if (m.date && m.date < o.aPartirDu) continue;
    let aDesCotes = false;
    for (const ligne of ["1.5", "2.5"] as const) {
      const plus = ligne === "1.5" ? m.cotes?.over15 : m.cotes?.over25;
      const moins = ligne === "1.5" ? m.cotes?.under15 : m.cotes?.under25;
      if (!estNombre(plus) || !estNombre(moins) || plus <= 1 || moins <= 1) continue;
      aDesCotes = true;
      const marge = margeBookmaker(plus, moins);
      for (const cote of ["plus", "moins"] as const) {
        const a = cote === "plus" ? plus : moins;
        const b = cote === "plus" ? moins : plus;
        if (o.coteMin !== null && a < o.coteMin) {
          ecartees++;
          continue;
        }
        if (o.mode === "lay" && b <= o.commission) continue;
        const j = jambeFreebet(o.montant, a, b, o.mode, o.commission, o.rembourse);
        candidats.push({
          matchId: m.id,
          match: `${m.domicile?.nom ?? "?"} – ${m.exterieur?.nom ?? "?"}`,
          date: m.date ?? null,
          heure: m.heure ?? null,
          ligue: m.ligue ?? null,
          bookmaker: m.cotes?.bookmaker ?? null,
          ligne,
          cote,
          coteFreebet: a,
          coteInverse: b,
          marge,
          miseCouverture: j.miseCouverture,
          gain: j.resultat,
          conversion: j.resultat / o.montant,
        });
      }
    }
    if (!aDesCotes) sansCotes++;
  }
  candidats.sort((x, y) => y.conversion - x.conversion || String(x.date).localeCompare(String(y.date)) || x.match.localeCompare(y.match, "fr"));
  return { candidats, sansCotes, ecartees };
}
