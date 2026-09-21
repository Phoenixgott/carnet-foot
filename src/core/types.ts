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
  /** Cotes « moins de 1,5 / 2,5 buts » : servent à calculer la marge du bookmaker. */
  under15?: number | null;
  under25?: number | null;
  bookmaker?: string | null;
}

/** Marchés suivis : plus de 1,5 but et plus de 2,5 buts. */
export type Marche = "over15" | "over25";

/** Un relevé de cotes, gardé pour suivre leur évolution dans le temps. */
export interface ReleveCotes {
  /** Date et heure du relevé (ISO) ; null pour des cotes reçues avant le suivi (date inconnue). */
  le: string | null;
  over15: number | null;
  over25: number | null;
  under15: number | null;
  under25: number | null;
  bookmaker: string | null;
  /** « import » : réponse de l'autre conversation Claude ; « saisie » : tapée à la main. */
  origine: "import" | "saisie";
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
  /** Relevés de cotes successifs, du plus ancien au plus récent (propre à l'application). */
  historiqueCotes?: ReleveCotes[] | null;
  /** Cote minimale choisie à la main, par marché ; sinon la cote mini calculée est utilisée. */
  coteCible?: Partial<Record<Marche, number | null>> | null;
  /** Champs supplémentaires éventuels : conservés tels quels. */
  [champ: string]: unknown;
}

/**
 * Un match terminé, venu d'un fichier CSV de football-data.co.uk (historiques).
 * Données publiques de référence : gardées à part des matchs à analyser.
 */
export interface Resultat {
  /** Code division + date + équipes : identifie le match d'un fichier à l'autre. */
  id: string;
  /** Code de division de football-data (E0, F1, SP1…) ou nom du championnat. */
  division: string;
  championnat: string;
  /** Saison « 2025-2026 », déduite de la date. */
  saison: string;
  date: string;
  heure: string | null;
  domicile: string;
  exterieur: string;
  butsDomicile: number;
  butsExterieur: number;
  butsMiTempsDomicile: number | null;
  butsMiTempsExterieur: number | null;
  /** Cotes plus/moins de 2,5 buts du fichier (moyenne du marché de préférence). */
  cotes: { over25: number | null; under25: number | null; source: string } | null;
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
