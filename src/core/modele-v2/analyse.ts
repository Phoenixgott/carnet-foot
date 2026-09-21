/**
 * Analyse d'un match avec le nouveau modèle, pour une méthode :
 * probabilité et sa fourchette, cote juste, cote minimale, value, risque, verdict expliqué.
 *
 * - Cote juste = 1 / probabilité estimée.
 * - Fourchette : buts attendus ± 1 écart type, soit environ 2 chances sur 3 que la vraie
 *   probabilité s'y trouve (à 90 %, la fourchette serait si large que presque rien ne passerait).
 * - Cote minimale = 1 / probabilité basse de la fourchette : la cote à exiger pour que
 *   le pari reste intéressant même si l'estimation est un peu trop optimiste.
 * - Value = cote × probabilité − 1 : ce que rapporte le pari en moyenne, par euro misé.
 * - Méthode +2.5 : le modèle (70 %) est mélangé à la part réelle de matchs à 3+ buts des deux
 *   équipes cette saison (30 %), quand elle est connue.
 * - Méthode +1.5 : chances d'au moins 2 buts dans le reste du match si c'est 0-0 à la 20ᵉ minute,
 *   avec la vraie répartition des buts dans le temps. La value se juge en live (phase 4).
 */
import { niveauRisque, type MethodeAnalysee } from "../carnet-v1/analyse";
import { evaluerPlus15, evaluerPlus25, type Evaluation, type Verdict } from "../carnet-v1/criteres";
import { fiabilite, type Fiabilite } from "../carnet-v1/fiabilite";
import { estNombre, fr } from "../format";
import { probabiliteSansMarge } from "../marge";
import { pPlusDe } from "../poisson";
import type { Match } from "../types";
import type { StatsChampionnat } from "./championnat";
import { estimer, type Estimation } from "./modele";
import { completerReglages, type ReglagesAnalyse } from "./reglages";
import { lambdaRestantA00, repartition } from "./temps";

export const POIDS_EMPIRIQUE = 0.3;
export const MINUTE_REFERENCE = 20;
/** Fourchette : ± 1 écart type (environ 2 chances sur 3). */
export const Z = 1;
/** Écart avec l'estimation du bookmaker au-delà duquel on prévient (10 points). */
export const ECART_BOOKMAKER = 0.1;

export interface AnalyseV2 {
  methode: MethodeAnalysee;
  ev: Evaluation;
  v: Verdict;
  /** Le verdict en une phrase. */
  why: string;
  p: number;
  pBas: number;
  pHaut: number;
  coteJuste: number;
  coteMinimale: number;
  /** Cote du marché comparée (plus de 2,5 buts avant-match) ; null si inconnue ou jugée en live. */
  cote: number | null;
  value: number;
  /** Probabilité selon le bookmaker, marge retirée (NaN si inconnue). */
  pBookmaker: number;
  risque: number;
  niveauRisque: number;
  rel: Fiabilite;
  est: Estimation;
  /** Explications propres à la méthode. */
  details: string[];
}

export interface ContexteAnalyse {
  stats: StatsChampionnat | null;
  reglages: ReglagesAnalyse;
}

const pct = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) + " %" : "?");
const signe = (x: number) => (x >= 0 ? "+" : "−") + Math.abs(Math.round(x * 100)) + " %";

export function analyserV2(m: Match, methode: MethodeAnalysee, ctx: ContexteAnalyse): AnalyseV2 {
  const reglages = completerReglages(ctx.reglages);
  const est = estimer(m, { stats: ctx.stats, poidsAbsents: reglages.poidsAbsents });
  const ev = methode === "+1.5" ? evaluerPlus15(m, reglages.seuils.plus15) : evaluerPlus25(m, reglages.seuils.plus25);
  const rel = fiabilite(m);
  const details: string[] = [];

  let p = NaN;
  let pBas = NaN;
  let pHaut = NaN;
  if (est.ok) {
    const bas = Math.max(est.lambda - Z * est.sigma, 0.05);
    const haut = est.lambda + Z * est.sigma;
    if (methode === "+1.5") {
      const rep = repartition(ctx.stats?.partPremiereMiTemps);
      const reste = (l: number) => lambdaRestantA00(l, est.sigma, MINUTE_REFERENCE, rep);
      p = pPlusDe(reste(est.lambda), 1.5);
      pBas = pPlusDe(reste(bas), 1.5);
      pHaut = pPlusDe(reste(haut), 1.5);
      details.push(
        `À 0-0 à la ${MINUTE_REFERENCE}ᵉ minute, il reste environ ${fr(reste(est.lambda))} buts attendus` +
          ` (répartition réelle des buts dans le temps${ctx.stats?.partPremiereMiTemps ? ", ajustée au championnat" : ""}, et le 0-0 lui-même rend le match un peu moins ouvert).`,
      );
    } else {
      const pm = (l: number) => pPlusDe(l, 2.5);
      p = pm(est.lambda);
      pBas = pm(bas);
      pHaut = pm(haut);
      const h = m.domicile?.pctOver25;
      const a = m.exterieur?.pctOver25;
      if (estNombre(h) && estNombre(a)) {
        const pe = (h + a) / 200;
        const melange = (x: number) => (1 - POIDS_EMPIRIQUE) * x + POIDS_EMPIRIQUE * pe;
        details.push(`Modèle : ${pct(p)} ; leurs matchs cette saison : ${pct(pe)} à 3 buts ou plus. Mélange 70 / 30.`);
        p = melange(p);
        pBas = melange(pBas);
        pHaut = melange(pHaut);
      } else {
        details.push("% de matchs à 3+ buts inconnu : modèle seul.");
      }
    }
  }

  const coteJuste = 1 / p;
  const coteMinimale = 1 / pBas;
  const cote = methode === "+2.5" && estNombre(m.cotes?.over25) ? m.cotes!.over25! : null;
  const value = cote !== null ? cote * p - 1 : NaN;
  const pBookmaker = methode === "+2.5" ? probabiliteSansMarge(m.cotes?.over25, m.cotes?.under25) : NaN;
  if (Number.isFinite(p)) {
    details.push(`Fourchette ${pct(pBas)} à ${pct(pHaut)} (2 chances sur 3) : cote juste ${fr(1 / p)}, cote minimale ${fr(1 / pBas)} pour rester gagnant dans le bas de la fourchette.`);
  }
  if (Number.isFinite(pBookmaker)) {
    details.push(`Le bookmaker, marge retirée, estime ${pct(pBookmaker)}.`);
    if (Number.isFinite(p) && Math.abs(p - pBookmaker) >= ECART_BOOKMAKER) {
      details.push(
        `Attention : ${Math.round(Math.abs(p - pBookmaker) * 100)} points d'écart avec le bookmaker. Un tel écart vient plus souvent` +
          " d'une info manquante ou d'une erreur du modèle que d'une erreur du bookmaker : la value affichée est à prendre avec prudence.",
      );
    }
  }
  const risque = Number.isFinite(pBas) ? Math.min(0.99, 1 - pBas * (0.5 + 0.5 * rel.f)) : NaN;

  // Verdict : critères (seuils réglables), puis fiabilité, puis cote.
  let v: Verdict = ev.v;
  let why = ev.why;
  if (rel.f < 0.5 && v === "ok") {
    v = "mid";
    why = "À vérifier : il manque trop d'infos pour se fier aux chiffres.";
  }
  if (!Number.isFinite(p)) {
    v = v === "ko" ? "ko" : "mid";
    if (v === "mid") why = "À vérifier : il manque des infos.";
  } else if (v !== "ko") {
    if (methode === "+1.5") {
      if (v === "ok") why = `Oui : à 0-0 vers la 15ᵉ-20ᵉ minute, entre en live à ${fr(coteMinimale)} ou plus.`;
    } else if (cote === null) {
      if (v === "ok") why = `Oui : vérifie les compositions 1 h avant et prends une cote d'au moins ${fr(coteMinimale)}.`;
    } else if (cote < coteJuste) {
      v = "ko";
      why = `Non : la cote ${fr(cote)} est sous la cote juste ${fr(coteJuste)} (value ${signe(value)}).`;
    } else if (cote < coteMinimale) {
      v = "mid";
      why = `À vérifier : la cote ${fr(cote)} dépasse la cote juste ${fr(coteJuste)}, mais pas la cote minimale ${fr(coteMinimale)} (marge d'erreur).`;
    } else if (v === "ok") {
      why = `Oui : la cote ${fr(cote)} donne une value de ${signe(value)} ; vérifie les compositions 1 h avant.`;
    }
  }

  return {
    methode,
    ev,
    v,
    why,
    p,
    pBas,
    pHaut,
    coteJuste,
    coteMinimale,
    cote,
    value,
    pBookmaker,
    risque,
    niveauRisque: niveauRisque(risque),
    rel,
    est,
    details,
  };
}
