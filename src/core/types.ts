/**
 * Types de données partagés par toute l'application.
 *
 * Le format d'un match reprend exactement celui du carnet d'origine
 * (et de la demande envoyée à l'autre conversation Claude), pour que
 * les réponses déjà produites restent importables sans conversion.
 * Un champ absent ou `null` signifie « donnée inconnue » : il est affiché ⏳,
 * jamais inventé ni traité comme une erreur.
 */

/** Statistiques d'une équipe, telles que fournies par l'import. */
export interface Equipe {
  nom?: string | null;
  /** Matchs de championnat joués (ou 10 derniers officiels pour une sélection). */
  joues?: number | null;
  marques?: number | null;
  encaisses?: number | null;
  /** % de matchs avec 2 buts ou plus au total (0-100). */
  pctOver15?: number | null;
  /** % de matchs avec 3 buts ou plus au total (0-100). */
  pctOver25?: number | null;
  /** Buts marqués par l'équipe sur ses derniers matchs, du plus récent au plus ancien. */
  derniersButsMarques?: Array<number | null> | null;
}

export interface ConfrontationsDirectes {
  joues?: number | null;
  over25?: number | null;
}

export interface CotesMatch {
  over15?: number | null;
  over25?: number | null;
  bookmaker?: string | null;
}

/** Contextes reconnus (identiques au carnet d'origine). */
export type Contexte =
  | "normal"
  | "finale"
  | "derby"
  | "maintien"
  | "montee"
  | "sans_enjeu"
  | "retour_coupe_retard";

export interface Match {
  id: string;
  date?: string | null;
  heure?: string | null;
  ligue?: string | null;
  journee?: string | null;
  selection?: boolean | null;
  feminin?: boolean | null;
  moyenneButsLigue?: number | null;
  domicile?: Equipe | null;
  exterieur?: Equipe | null;
  h2h?: ConfrontationsDirectes | null;
  contexte?: string | null;
  absents?: string[] | null;
  absenceOffensive?: boolean | null;
  meilleurButeurAbsent?: boolean | null;
  defenseAffaiblie?: boolean | null;
  cotes?: CotesMatch | null;
  manquants?: string[] | null;
  sources?: string[] | null;
  /** Champs supplémentaires éventuels : conservés tels quels. */
  [champ: string]: unknown;
}

/** Les méthodes. Leurs noms ne doivent jamais changer. */
export type Methode = "+1.5" | "+2.5" | "Freebet" | "Autre";

export type StatutPari = "attente" | "gagne" | "perdu" | "manuel" | "rembourse";

export interface Pari {
  id: string;
  /** Position d'origine dans le journal (ordre de saisie). */
  ordre: number;
  date: string;
  match: string;
  methode: Methode;
  cote: number;
  mise: number;
  statut: StatutPari;
  /** Gain saisi à la main quand le statut est « manuel » (pari sécurisé). */
  pnl?: number;
  notes?: string;
  creeLe: string;
  modifieLe: string;
  /** Trace de l'origine quand le pari vient du carnet d'origine. */
  origine?: { carnet: { index: number; methode: string } };
}

export interface ReglagesBankroll {
  /** Bankroll de départ en euros. */
  depart: number;
  /** Mise par pari, en % de la bankroll courante. */
  pctMise: number;
}

/** Une entrée de la table des réglages (clé/valeur). */
export interface Reglage<T = unknown> {
  cle: string;
  valeur: T;
}
