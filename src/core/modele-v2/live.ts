/**
 * Méthode +1.5 en live (phase 4) : fenêtre d'entrée, décision « j'entre ? », et couverture
 * après le premier but avec le résultat de chaque scénario.
 *
 * Décision d'entrée : mêmes règles et mêmes textes que le carnet, mais avec le nouveau modèle
 * (vraie répartition des buts dans le temps, 0-0 pris en compte, fourchette). Nouveauté : entre la
 * cote juste et la cote minimale, la value est positive mais dans la marge d'erreur du modèle :
 * on entre avec la moitié de la mise (même logique que la méthode +2.5 du carnet).
 *
 * Couverture : formules du carnet (couverture.ts). Nouveauté : chances d'un 2ᵉ but d'après le
 * modèle, donc l'espérance de « ne pas couvrir » à comparer au gain garanti.
 */
import type { Evaluation, Verdict } from "../carnet-v1/criteres";
import { couvertureLay, couverturePariContraire, resultatCashOut } from "../couverture";
import { estNombre, fr } from "../format";
import { pPlusDe } from "../poisson";
import { Z } from "./analyse";
import { lambdaRestantApres, REPARTITION_PAR_DEFAUT } from "./temps";

/* ------------------------------------------------------------------ */
/* Fenêtre d'entrée                                                    */

export const FENETRE_OUVERTURE = 15;
/** Dernière minute de la fenêtre (comprise) : elle se ferme à la 21ᵉ minute. */
export const FENETRE_FERMETURE = 20;
/** À partir de cette minute, on prévient qu'elle approche. */
export const FENETRE_PREVENTION = 12;

export type EtatFenetre = "non-lance" | "trop-tot" | "bientot" | "ouverte" | "passee" | "tard";

export interface Fenetre {
  etat: EtatFenetre;
  titre: string;
  detail: string;
}

/** État de la fenêtre 15ᵉ-20ᵉ minute ; `minute` est null tant que le chronomètre n'est pas lancé. */
export function fenetre(minute: number | null, secondes = 0): Fenetre {
  if (minute === null) {
    return { etat: "non-lance", titre: "Chronomètre arrêté", detail: "Lance-le au coup d'envoi, ou règle la minute à la main." };
  }
  if (minute < FENETRE_PREVENTION) {
    const reste = FENETRE_OUVERTURE - minute;
    return { etat: "trop-tot", titre: "Trop tôt", detail: `La fenêtre s'ouvre à la 15ᵉ minute (dans ${reste} min).` };
  }
  if (minute < FENETRE_OUVERTURE) {
    return { etat: "bientot", titre: "Prépare-toi", detail: `Ouverture à la 15ᵉ minute (dans ${FENETRE_OUVERTURE - minute} min).` };
  }
  if (minute <= FENETRE_FERMETURE) {
    const reste = Math.max(FENETRE_FERMETURE + 1 - minute - (secondes > 0 ? 1 : 0), 0);
    return {
      etat: "ouverte",
      titre: "Fenêtre ouverte",
      detail: reste > 0 ? `15ᵉ-20ᵉ minute : encore ${reste} min pour entrer.` : "15ᵉ-20ᵉ minute : dernières secondes.",
    };
  }
  if (minute <= 30) {
    return { etat: "passee", titre: "Fenêtre passée", detail: "Tu peux encore entrer, mais la cote minimale monte à chaque minute (voir le tableau)." };
  }
  return { etat: "tard", titre: "Trop tard", detail: "Le temps qui reste est court : la cote minimale devient très haute." };
}

/* ------------------------------------------------------------------ */
/* Décision d'entrée                                                   */

export interface EntreeLive {
  /** Buts attendus sur 90 minutes et leur écart type. */
  lambda: number;
  sigma: number;
  rep?: readonly number[];
  minute: number;
  /** Cote « plus de 1,5 but » proposée. */
  cote: number;
  /** Le score est encore 0-0. */
  scoreNul: boolean;
  /** Le match est animé (appréciation personnelle). */
  anime: boolean;
  /** Évaluation +1.5 du match choisi (critères), si un match est choisi. */
  evaluation: Evaluation | null;
  miseBase: number;
}

export interface DecisionLive {
  v: Verdict;
  titre: string;
  pourquoi: string;
  /** Chances d'au moins 2 buts dans le reste du match, à 0-0 à cette minute. */
  p: number;
  pBas: number;
  pHaut: number;
  coteJuste: number;
  coteMinimale: number;
  /** cote × p − 1 (NaN si la cote est inconnue). */
  value: number;
  /** Mise conseillée (null : ne pas entrer maintenant). */
  mise: number | null;
}

/** Chances de ≥ 2 buts sur le reste du match, à 0-0 à cette minute, avec la fourchette. */
export function chancesLive(lambda: number, sigma: number, minute: number, rep: readonly number[] = REPARTITION_PAR_DEFAUT) {
  const m = Math.min(Math.max(minute, 0), 90);
  const reste = (l: number) => pPlusDe(lambdaRestantApres(l, sigma, m, 0, rep), 1.5);
  const bas = Math.max(lambda - Z * sigma, 0.05);
  const haut = lambda + Z * sigma;
  const p = reste(lambda);
  const pBas = reste(bas);
  return { p, pBas, pHaut: reste(haut), coteJuste: 1 / p, coteMinimale: 1 / pBas };
}

export function decisionLive(e: EntreeLive): DecisionLive {
  const minute = Math.min(Math.max(e.minute, 0), 90);
  const c = chancesLive(e.lambda, e.sigma, minute, e.rep);
  const value = estNombre(e.cote) ? e.cote * c.p - 1 : NaN;
  const sortie = (v: Verdict, titre: string, pourquoi: string, mise: number | null): DecisionLive => ({ v, titre, pourquoi, ...c, value, mise });

  if (!e.scoreNul) return sortie("ko", "Non", "Un but est déjà marqué : la méthode ne marche qu'à 0-0.", null);
  if (e.evaluation && e.evaluation.v === "ko") return sortie("ko", "Non", "Ce match ne remplit pas les critères (voir la fiche du match).", null);
  if (!Number.isFinite(c.p)) return sortie("mid", "Il manque des infos", "Sans buts attendus, je ne peux pas calculer la cote juste.", null);
  if (!estNombre(e.cote) || e.cote <= 1) return sortie("mid", "Saisis la cote", `Cote juste ${fr(c.coteJuste)}, cote minimale ${fr(c.coteMinimale)} à cette minute.`, null);
  if (value <= 0) return sortie("ko", "Pas encore", `Attends que la cote monte à ${fr(c.coteJuste)} ou plus.`, null);
  if (!e.anime) return sortie("mid", "Patience", "La cote est bonne, mais le match est fermé. Attends qu'il s'anime.", null);
  if (minute < FENETRE_PREVENTION) return sortie("mid", "Un peu tôt", "Attends la 15ᵉ-20ᵉ minute : la cote sera meilleure.", null);
  if (e.cote < c.coteMinimale) {
    return sortie(
      "mid",
      "Oui, mais mise la moitié",
      `La cote ${fr(e.cote)} dépasse la cote juste ${fr(c.coteJuste)}, mais pas la cote minimale ${fr(c.coteMinimale)} (marge d'erreur du modèle).`,
      e.miseBase / 2,
    );
  }
  if (e.cote < 1.6) return sortie("mid", "Possible", "Ça vaut le coup, mais vise plutôt une cote autour de 1,70.", e.miseBase);
  return sortie("ok", "Oui, tu peux parier", `La cote ${fr(e.cote)} est au-dessus de la cote minimale ${fr(c.coteMinimale)} (cote juste ${fr(c.coteJuste)}).`, e.miseBase);
}

/** Minutes du tableau « cote minimale selon la minute ». */
export const MINUTES_TABLEAU = [15, 20, 25, 30, 35, 40] as const;

export function tableauLive(lambda: number, sigma: number, rep: readonly number[] = REPARTITION_PAR_DEFAUT) {
  return MINUTES_TABLEAU.map((minute) => ({ minute, ...chancesLive(lambda, sigma, minute, rep) }));
}

/* ------------------------------------------------------------------ */
/* Couverture après le premier but                                     */

export type ModeCouverture = "contre" | "lay" | "cash";

export interface EntreeCouverture {
  mode: ModeCouverture;
  /** Mise et cote du pari « plus de 1,5 but » déjà placé. */
  mise: number;
  cote: number;
  /** Mode « contre » : cote « moins de 1,5 but » chez un autre bookmaker. */
  coteContraire: number | null;
  /** Mode « lay » : cote lay de « plus de 1,5 but » et commission en % (5 pour 5 %). */
  coteLay: number | null;
  commission: number;
  /** Mode « cash » : montant proposé par le bookmaker. */
  cashOut: number | null;
  /** Pour les chances d'un 2ᵉ but. */
  lambda: number;
  sigma: number;
  minuteBut: number;
  rep?: readonly number[];
}

export interface ResultatCouverture {
  /** Toutes les valeurs nécessaires sont saisies et possibles. */
  calculable: boolean;
  /** Mise à placer (« contre » : sur « moins de 1,5 » ; « lay » : mise lay) ; null en cash-out. */
  miseCouverture: number | null;
  /** Somme bloquée sur l'exchange (mode lay). */
  responsabilite: number | null;
  /** Résultat final en couvrant : si un 2ᵉ but arrive / s'il n'y en a plus. */
  siBut: number;
  siPasDeBut: number;
  /** Le moins bon des deux. */
  garanti: number;
  /** Le gain est positif quoi qu'il arrive. */
  rentable: boolean;
  /** Cote limite pour que la couverture rapporte : « min » (au moins) ou « max » (au plus) ; null en cash-out. */
  seuil: { type: "min" | "max"; cote: number } | null;
  /** Ne pas couvrir. */
  sansCouvrir: { siBut: number; siPasDeBut: number; esperance: number };
  /** Chances d'un 2ᵉ but avant la fin (estimation du modèle). */
  pBut: number;
}

/** Chances qu'au moins un autre but soit marqué, sachant qu'un but vient de l'être à cette minute. */
export function chancesDeuxiemeBut(lambda: number, sigma: number, minuteBut: number, rep: readonly number[] = REPARTITION_PAR_DEFAUT): number {
  const reste = lambdaRestantApres(lambda, sigma, Math.min(Math.max(minuteBut, 0), 90), 1, rep);
  return 1 - Math.exp(-reste);
}

export function couvrir(e: EntreeCouverture): ResultatCouverture {
  const S = e.mise;
  const O = e.cote;
  const pBut = chancesDeuxiemeBut(e.lambda, e.sigma, e.minuteBut, e.rep);
  const sansCouvrir = {
    siBut: S * (O - 1),
    siPasDeBut: -S,
    esperance: Number.isFinite(pBut) ? pBut * S * (O - 1) - (1 - pBut) * S : NaN,
  };
  const vide: ResultatCouverture = {
    calculable: false,
    miseCouverture: null,
    responsabilite: null,
    siBut: NaN,
    siPasDeBut: NaN,
    garanti: NaN,
    rentable: false,
    seuil: null,
    sansCouvrir,
    pBut,
  };
  if (!(S > 0) || !(O > 1)) return vide;

  if (e.mode === "contre") {
    const X = e.coteContraire;
    if (!estNombre(X) || X <= 1) return vide;
    const k = couverturePariContraire(S, O, X);
    return {
      ...vide,
      calculable: true,
      miseCouverture: k.miseCouverture,
      siBut: k.profit,
      siPasDeBut: k.profit,
      garanti: k.profit,
      rentable: k.profit > 0,
      // profit > 0 ⟺ X > O / (O − 1)
      seuil: { type: "min", cote: O / (O - 1) },
    };
  }
  if (e.mode === "lay") {
    const X = e.coteLay;
    const c = e.commission / 100;
    if (!estNombre(X) || X <= 1 || !(c >= 0 && c < 1) || X <= c) return vide;
    const k = couvertureLay(S, O, X, c);
    return {
      ...vide,
      calculable: true,
      miseCouverture: k.miseLay,
      responsabilite: k.responsabilite,
      siBut: k.siBut,
      siPasDeBut: k.siPasDeBut,
      garanti: k.profitMin,
      rentable: k.profitMin > 0,
      // profit > 0 ⟺ X < O (1 − c) + c
      seuil: { type: "max", cote: O * (1 - c) + c },
    };
  }
  const C = e.cashOut;
  if (!estNombre(C) || C < 0) return vide;
  const gain = resultatCashOut(S, C);
  return { ...vide, calculable: true, siBut: gain, siPasDeBut: gain, garanti: gain, rentable: gain > 0, seuil: null };
}
