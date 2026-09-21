/**
 * Nouveau modèle de buts attendus (phase 3), à côté de celui du carnet.
 *
 * 1. Moyenne de la compétition μ = buts par équipe et par match (moyenneButsLigue / 2 ;
 *    à défaut celle des historiques CSV ; à défaut celle des deux équipes).
 * 2. Forces : attaque = buts marqués par match / μ ; défense = buts encaissés par match / μ.
 *    Chaque moyenne est « ramenée vers la moyenne » comme si l'équipe avait joué 4 matchs de plus
 *    dans la moyenne de la compétition : sur 3 matchs, un 4-0 ne fait pas une équipe exceptionnelle.
 * 3. Avantage du terrain : rapport buts domicile / extérieur du championnat (CSV), sinon 1,25 ;
 *    terrain neutre pour une finale. Il est partagé : √rapport pour l'un, 1/√rapport pour l'autre.
 * 4. Forme : buts marqués sur les derniers matchs comparés à la moyenne de la saison,
 *    effet volontairement limité (±15 % au plus).
 * 5. Absents : attaquant absent −6 %, meilleur buteur absent −8 %, défense affaiblie +5 %,
 *    multipliés par le poids choisi dans les réglages (0 = ignorés, 1 = normal, 2 = double).
 *
 * λ domicile = μ × attaque dom × défense ext × √avantage × forme dom
 * λ extérieur = μ × attaque ext × défense dom / √avantage × forme ext
 *
 * Incertitude (écart type de λ) : erreur d'échantillonnage des moyennes (loi de Poisson :
 * variance ≈ moyenne / nombre de matchs) plus 8 % d'erreur de modèle.
 */
import { estNombre, fr } from "../format";
import type { Equipe, Match } from "../types";
import { AVANTAGE_TERRAIN_DEFAUT, type StatsChampionnat } from "./championnat";

export const MATCHS_FICTIFS = 4;
export const ERREUR_MODELE = 0.08;
export const EFFET_ABSENTS = { attaquant: 0.06, meilleurButeur: 0.08, defense: 0.05 } as const;
export const FORME_MAX = 0.15;

export interface OptionsModele {
  /** Chiffres du championnat (historiques CSV) ; null si aucun. */
  stats: StatsChampionnat | null;
  /** Poids des absents (0 à 2 ; 1 = normal). */
  poidsAbsents: number;
}

export interface Estimation {
  ok: boolean;
  lambdaDomicile: number;
  lambdaExterieur: number;
  /** Buts attendus sur le match. */
  lambda: number;
  /** Écart type de λ. */
  sigma: number;
  mu: number;
  sourceMoyenne: "competition" | "historiques" | "equipes";
  avantage: { rapport: number; source: "historiques" | "defaut" | "neutre" };
  formeDomicile: number;
  formeExterieur: number;
  facteurAbsents: number;
  /** Explications lisibles, une par étape du calcul. */
  details: string[];
}

interface Taux {
  n: number;
  marques: number;
  encaisses: number;
}

function taux(e: Equipe | null | undefined): Taux | null {
  if (!e || !estNombre(e.joues) || e.joues <= 0 || !estNombre(e.marques) || !estNombre(e.encaisses)) return null;
  return { n: e.joues, marques: e.marques / e.joues, encaisses: e.encaisses / e.joues };
}

/** Moyenne ramenée vers μ : (n × valeur + 4 × μ) / (n + 4). */
const ramener = (valeur: number, n: number, mu: number) => (n * valeur + MATCHS_FICTIFS * mu) / (n + MATCHS_FICTIFS);

function forme(e: Equipe | null | undefined, marquesParMatch: number): number {
  const l = (e?.derniersButsMarques ?? []).filter(estNombre).slice(0, 4);
  if (l.length < 3 || !(marquesParMatch > 0)) return 1;
  const recent = l.reduce((s, x) => s + x, 0) / l.length;
  return Math.min(1 + FORME_MAX, Math.max(1 - FORME_MAX, 1 + 0.25 * (recent / marquesParMatch - 1)));
}

const pc = (x: number) => (x >= 1 ? "+" : "−") + Math.abs(Math.round((x - 1) * 100)) + " %";

export function estimer(m: Match, o: OptionsModele): Estimation {
  const d = taux(m.domicile);
  const e = taux(m.exterieur);
  const nomD = m.domicile?.nom || "Domicile";
  const nomE = m.exterieur?.nom || "Extérieur";
  const vide: Estimation = {
    ok: false,
    lambdaDomicile: NaN,
    lambdaExterieur: NaN,
    lambda: NaN,
    sigma: NaN,
    mu: NaN,
    sourceMoyenne: "equipes",
    avantage: { rapport: NaN, source: "defaut" },
    formeDomicile: 1,
    formeExterieur: 1,
    facteurAbsents: 1,
    details: ["Buts marqués et encaissés inconnus : pas d'estimation possible."],
  };
  if (!d || !e) return vide;
  const details: string[] = [];

  // 1. Moyenne de la compétition
  let mu: number;
  let sourceMoyenne: Estimation["sourceMoyenne"];
  if (estNombre(m.moyenneButsLigue) && m.moyenneButsLigue > 0) {
    mu = m.moyenneButsLigue / 2;
    sourceMoyenne = "competition";
    details.push(`Compétition : ${fr(m.moyenneButsLigue)} buts par match.`);
  } else if (o.stats && o.stats.moyenneButs > 0) {
    mu = o.stats.moyenneButs / 2;
    sourceMoyenne = "historiques";
    details.push(`Compétition : ${fr(o.stats.moyenneButs)} buts par match d'après tes historiques (${o.stats.saisons}), faute de moyenne actuelle.`);
  } else {
    mu = (d.marques + d.encaisses + e.marques + e.encaisses) / 4;
    sourceMoyenne = "equipes";
    details.push(`Moyenne de la compétition inconnue : celle des deux équipes est utilisée (${fr(mu * 2)} buts par match), estimation moins sûre.`);
  }
  if (!(mu > 0)) return { ...vide, details: ["Aucun but chez ces équipes : pas d'estimation possible."] };

  // 2. Forces ramenées vers la moyenne
  const attD = ramener(d.marques, d.n, mu) / mu;
  const defD = ramener(d.encaisses, d.n, mu) / mu;
  const attE = ramener(e.marques, e.n, mu) / mu;
  const defE = ramener(e.encaisses, e.n, mu) / mu;
  details.push(
    `Forces (1 = moyenne) : ${nomD} attaque ${fr(attD)}, défense ${fr(defD)} ; ${nomE} attaque ${fr(attE)}, défense ${fr(defE)}` +
      ` (sur ${d.n} et ${e.n} matchs, ramenées vers la moyenne).`,
  );

  // 3. Avantage du terrain
  let rapport = AVANTAGE_TERRAIN_DEFAUT;
  let sourceAvantage: Estimation["avantage"]["source"] = "defaut";
  if (m.contexte === "finale") {
    rapport = 1;
    sourceAvantage = "neutre";
    details.push("Finale : terrain considéré comme neutre.");
  } else if (o.stats && Number.isFinite(o.stats.avantageTerrain) && o.stats.nb >= 30) {
    rapport = o.stats.avantageTerrain;
    sourceAvantage = "historiques";
    details.push(`Avantage du terrain : ${fr(o.stats.butsDomicile)} buts à domicile pour ${fr(o.stats.butsExterieur)} à l'extérieur (${o.stats.nb} matchs, ${o.stats.saisons}).`);
  } else {
    details.push(`Avantage du terrain : ${fr(AVANTAGE_TERRAIN_DEFAUT)} (valeur moyenne ; importe les historiques CSV du championnat pour la vraie valeur).`);
  }
  const r = Math.sqrt(rapport);

  // 4. Forme
  const fD = forme(m.domicile, d.marques);
  const fE = forme(m.exterieur, e.marques);
  if (fD !== 1 || fE !== 1) details.push(`Forme récente : ${nomD} ${pc(fD)}, ${nomE} ${pc(fE)}.`);

  // 5. Absents
  const w = Math.min(Math.max(o.poidsAbsents, 0), 2);
  let fA = 1;
  const effets: string[] = [];
  if (m.absenceOffensive) {
    fA *= 1 - EFFET_ABSENTS.attaquant * w;
    effets.push("attaquant absent");
  }
  if (m.meilleurButeurAbsent) {
    fA *= 1 - EFFET_ABSENTS.meilleurButeur * w;
    effets.push("meilleur buteur absent");
  }
  if (m.defenseAffaiblie) {
    fA *= 1 + EFFET_ABSENTS.defense * w;
    effets.push("défense affaiblie");
  }
  if (effets.length) details.push(`Absents (${effets.join(", ")}) : ${pc(fA)} de buts${w === 1 ? "" : `, poids ${fr(w, 1)}`}.`);

  const lambdaDomicile = mu * attD * defE * r * fD * fA;
  const lambdaExterieur = (mu * attE * defD * fE * fA) / r;
  const lambda = lambdaDomicile + lambdaExterieur;

  // Incertitude
  const sd = ramener(d.marques, d.n, mu);
  const se = ramener(e.marques, e.n, mu);
  const cd = ramener(d.encaisses, d.n, mu);
  const ce = ramener(e.encaisses, e.n, mu);
  const nD = d.n + MATCHS_FICTIFS;
  const nE = e.n + MATCHS_FICTIFS;
  const sigD = lambdaDomicile * Math.sqrt(1 / (nD * sd) + 1 / (nE * ce));
  const sigE = lambdaExterieur * Math.sqrt(1 / (nE * se) + 1 / (nD * cd));
  const sigma = Math.sqrt(sigD ** 2 + sigE ** 2 + (ERREUR_MODELE * lambda) ** 2);
  details.push(`Buts attendus : ${fr(lambdaDomicile)} + ${fr(lambdaExterieur)} = ${fr(lambda)} (± ${fr(sigma)}).`);

  return {
    ok: true,
    lambdaDomicile,
    lambdaExterieur,
    lambda,
    sigma,
    mu,
    sourceMoyenne,
    avantage: { rapport, source: sourceAvantage },
    formeDomicile: fD,
    formeExterieur: fE,
    facteurAbsents: fA,
    details,
  };
}
