/**
 * Décisions « j'entre ? » (+1.5 en live) et « je parie ? » (+2.5 avant le match)
 * du carnet d'origine, reprises à l'identique. Aucune dépendance à l'écran :
 * l'interface fournit les valeurs saisies, ces fonctions rendent le verdict.
 */
import { fr } from "../format";
import { lambdaRestant, pPlusDe } from "../poisson";
import type { Evaluation, Verdict } from "./criteres";

export interface Decision {
  v: Verdict;
  titre: string;
  pourquoi: string;
  /** Probabilité estimée de gagner le pari. */
  p: number;
  /** Cote juste (minimum pour que le pari vaille le coup). */
  coteJuste: number;
  /** Mise conseillée en euros, quand le verdict en propose une (sinon null). */
  mise: number | null;
}

export interface EntreeLive {
  /** Buts attendus sur 90 minutes. */
  lambda: number;
  minute: number;
  cote: number;
  /** Le score est encore 0-0. */
  scoreNul: boolean;
  /** Le match est animé (appréciation personnelle). */
  anime: boolean;
  /** Évaluation +1.5 du match choisi, si un match est choisi. */
  evaluation: Evaluation | null;
  /** Mise de base (règle de mise en vigueur). */
  miseBase: number;
}

/** Minutes du tableau « cote minimale selon la minute ». */
export const MINUTES_TABLEAU_LIVE = [15, 20, 25, 30, 35, 40] as const;

/** Décision d'entrée en live pour la méthode +1.5 (le `calcL1` du carnet). */
export function decisionEntreeLive(e: EntreeLive): Decision {
  const minute = Math.min(Math.max(e.minute, 0), 90);
  const p = pPlusDe(lambdaRestant(e.lambda, minute), 1.5);
  const coteJuste = 1 / p;
  const avantage = e.cote * p - 1;
  let v: Verdict = "ok";
  let titre = "Oui, tu peux parier";
  let pourquoi = `La cote ${fr(e.cote)} est au-dessus de ${fr(coteJuste)}, le minimum pour que ça vaille le coup.`;
  if (!e.scoreNul) {
    v = "ko"; titre = "Non"; pourquoi = "Un but est déjà marqué : la méthode ne marche qu'à 0-0.";
  } else if (e.evaluation && e.evaluation.v === "ko") {
    v = "ko"; titre = "Non"; pourquoi = "Ce match ne remplit pas les critères (voir étape 1).";
  } else if (avantage <= 0) {
    v = "ko"; titre = "Pas encore"; pourquoi = `Attends que la cote monte à ${fr(coteJuste)} ou plus.`;
  } else if (!e.anime) {
    v = "mid"; titre = "Patience"; pourquoi = "La cote est bonne, mais le match est fermé. Attends qu'il s'anime.";
  } else if (minute < 12) {
    v = "mid"; titre = "Un peu tôt"; pourquoi = "Attends la 15ᵉ-20ᵉ minute : la cote sera meilleure.";
  } else if (e.cote < 1.6) {
    v = "mid"; titre = "Possible"; pourquoi = "Ça vaut le coup, mais vise plutôt une cote autour de 1,70.";
  }
  return { v, titre, pourquoi, p, coteJuste, mise: v === "ok" ? e.miseBase : null };
}

/** Cote minimale à accepter à chaque minute du tableau, si le score est toujours 0-0. */
export function tableauCotesLive(lambda: number): Array<{ minute: number; coteMini: number }> {
  return MINUTES_TABLEAU_LIVE.map((minute) => ({ minute, coteMini: 1 / pPlusDe(lambdaRestant(lambda, minute), 1.5) }));
}

export interface EntreeAvantMatch {
  lambda: number;
  cote: number;
  /** Compositions vues, attaquants titulaires. */
  compositionsVues: boolean;
  evaluation: Evaluation | null;
  miseBase: number;
}

/** Décision de pari avant-match pour la méthode +2.5 (le `calcV3` du carnet). */
export function decisionAvantMatch(e: EntreeAvantMatch): Decision {
  const p = pPlusDe(e.lambda, 2.5);
  const coteJuste = 1 / p;
  const avantage = e.cote * p - 1;
  let v: Verdict = "ok";
  let titre = "Oui, tu peux parier";
  let pourquoi = `La cote ${fr(e.cote)} est au-dessus de ${fr(coteJuste)}, le minimum pour que ça vaille le coup.`;
  let mise = e.miseBase;
  if (e.evaluation && e.evaluation.v === "ko") {
    v = "ko"; titre = "Non";
    const w = e.evaluation.why.replace(/^Non : /, "");
    pourquoi = w.charAt(0).toUpperCase() + w.slice(1);
  } else if (avantage <= 0) {
    v = "ko"; titre = "Cote trop basse"; pourquoi = `Il faudrait au moins ${fr(coteJuste)}.`;
  } else if (!e.compositionsVues) {
    v = "mid"; titre = "Attends les compositions";
    pourquoi = "La cote est bonne. Vérifie d'abord que les attaquants sont titulaires.";
  } else if (e.evaluation && e.evaluation.v === "mid") {
    v = "mid"; titre = "Oui, mais mise la moitié";
    pourquoi = "La cote est bonne, mais tous les critères ne sont pas au vert.";
    mise = e.miseBase / 2;
  }
  return { v, titre, pourquoi, p, coteJuste, mise: v !== "ko" && e.compositionsVues ? mise : null };
}
