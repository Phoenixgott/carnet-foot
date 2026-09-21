/**
 * Suivi des cotes dans le temps et alerte « cote minimale atteinte ».
 *
 * Chaque fois que les cotes d'un match changent (import ou saisie à la main),
 * un relevé est ajouté à `historiqueCotes`. Une alerte est active quand la
 * dernière cote d'un marché atteint (≥) la cote minimale :
 *  - celle choisie à la main (`coteCible`), sinon
 *  - pour « plus de 2,5 buts », la cote mini calculée par le carnet (méthode +2.5).
 * Pour « plus de 1,5 but », pas de cote mini par défaut : la méthode +1.5 se joue
 * en live, sa cote mini (à la 20ᵉ minute) ne se compare pas à la cote avant-match.
 */
import { analyser } from "./carnet-v1/analyse";
import { estNombre, fr } from "./format";
import type { CotesMatch, Marche, Match, ReleveCotes } from "./types";

export const MARCHES: readonly Marche[] = ["over15", "over25"];

export const LIBELLE_MARCHE: Readonly<Record<Marche, string>> = {
  over15: "plus de 1,5 but",
  over25: "plus de 2,5 buts",
};

const CHAMPS_COTES = ["over15", "over25", "under15", "under25"] as const;

const valeur = (v: unknown): number | null => (estNombre(v) ? v : null);

/** Relevé des cotes actuelles d'un match (null si aucune cote connue). */
export function releveDe(cotes: CotesMatch | null | undefined, le: string | null, origine: ReleveCotes["origine"]): ReleveCotes | null {
  if (!cotes) return null;
  const r: ReleveCotes = {
    le,
    over15: valeur(cotes.over15),
    over25: valeur(cotes.over25),
    under15: valeur(cotes.under15),
    under25: valeur(cotes.under25),
    bookmaker: typeof cotes.bookmaker === "string" && cotes.bookmaker.trim() ? cotes.bookmaker.trim() : null,
    origine,
  };
  return CHAMPS_COTES.some((k) => r[k] !== null) ? r : null;
}

/** Vrai si deux relevés portent les mêmes cotes (la date et l'origine ne comptent pas). */
export function memesCotes(a: ReleveCotes | null | undefined, b: ReleveCotes | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return CHAMPS_COTES.every((k) => a[k] === b[k]) && a.bookmaker === b.bookmaker;
}

/** Dernier relevé du suivi (null s'il n'y en a pas). */
export function dernierReleve(m: Match): ReleveCotes | null {
  const h = Array.isArray(m.historiqueCotes) ? m.historiqueCotes : [];
  return h.length ? h[h.length - 1] : null;
}

/**
 * Match reçu avant le suivi des cotes (ex. import du carnet) : ses cotes actuelles
 * deviennent un premier relevé, de date inconnue, pour ne pas les perdre du suivi.
 */
export function amorcerSuivi(m: Match): Match {
  if (Array.isArray(m.historiqueCotes) && m.historiqueCotes.length) return m;
  const r = releveDe(m.cotes, null, "import");
  return r ? { ...m, historiqueCotes: [r] } : m;
}

/**
 * Ajoute au suivi les cotes actuelles du match si elles ont changé depuis le dernier relevé.
 * Renvoie une copie du match (le match reçu n'est pas modifié).
 */
export function suivreCotes(m: Match, le: string, origine: ReleveCotes["origine"]): Match {
  const r = releveDe(m.cotes, le, origine);
  if (!r || memesCotes(r, dernierReleve(m))) return m;
  return { ...m, historiqueCotes: [...(Array.isArray(m.historiqueCotes) ? m.historiqueCotes : []), r] };
}

export interface CoteMinimale {
  valeur: number;
  /** « choisie » : tapée à la main ; « calculee » : cote mini de la méthode +2.5. */
  origine: "choisie" | "calculee";
}

/** Cote minimale d'un marché pour ce match (null si aucune). */
export function coteMinimale(m: Match, marche: Marche): CoteMinimale | null {
  const choisie = m.coteCible?.[marche];
  if (estNombre(choisie) && choisie > 1) return { valeur: choisie, origine: "choisie" };
  if (marche === "over25") {
    const fair = analyser(m, "+2.5").fair;
    if (Number.isFinite(fair) && fair > 1) return { valeur: fair, origine: "calculee" };
  }
  return null;
}

export interface AlerteCote {
  matchId: string;
  marche: Marche;
  cote: number;
  minimale: CoteMinimale;
  texte: string;
}

const nomMatch = (m: Match) => `${m.domicile?.nom ?? "?"} – ${m.exterieur?.nom ?? "?"}`;

/**
 * Alertes actives : la cote actuelle d'un marché atteint la cote minimale.
 * Comparaison sur la cote affichée à 2 décimales, comme le reste de l'application
 * (une cote mini de 1,7999 s'affiche 1,80 : une cote de 1,80 l'atteint).
 */
export function alertesCote(m: Match): AlerteCote[] {
  const alertes: AlerteCote[] = [];
  for (const marche of MARCHES) {
    const cote = m.cotes?.[marche];
    const min = coteMinimale(m, marche);
    if (!estNombre(cote) || !min) continue;
    if (Math.round(cote * 100) >= Math.round(min.valeur * 100)) {
      alertes.push({
        matchId: m.id,
        marche,
        cote,
        minimale: min,
        texte: `${nomMatch(m)} : ${LIBELLE_MARCHE[marche]} à ${fr(cote)} (cote mini ${min.origine === "choisie" ? "choisie" : "calculée"} : ${fr(min.valeur)})`,
      });
    }
  }
  return alertes;
}

/** Alertes présentes après un changement mais pas avant : ce sont elles qu'on notifie. */
export function nouvellesAlertes(avant: readonly Match[], apres: readonly Match[]): AlerteCote[] {
  const deja = new Set(avant.flatMap(alertesCote).map((a) => a.matchId + "|" + a.marche));
  return apres.flatMap(alertesCote).filter((a) => !deja.has(a.matchId + "|" + a.marche));
}

/** Évolution d'une cote par rapport au relevé précédent : +1 monte, −1 baisse, 0 identique ou inconnu. */
export function sens(avant: number | null, apres: number | null): -1 | 0 | 1 {
  if (avant === null || apres === null || avant === apres) return 0;
  return apres > avant ? 1 : -1;
}
