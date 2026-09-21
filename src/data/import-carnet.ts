/**
 * Migration depuis le carnet d'origine (artefact « Carnet de Paris Foot »).
 *
 * Formats acceptés :
 *  1. « export complet » produit par le bouton « Tout exporter » du carnet :
 *     { app: "carnet-paris-foot", type: "export-complet", version: 1, cles: {...}, controle: {...} }
 *     Il contient matchs, paris, réglages, compétitions, et des valeurs de contrôle
 *     calculées par le carnet lui-même (bankroll, gains…) pour vérifier la migration.
 *  2. « ancienne sauvegarde » du bouton « Copier ma sauvegarde » : { paris: [...], reglages: {...} }
 *     (paris et réglages seulement, sans valeurs de contrôle).
 *
 * Fonctions pures : aucune écriture ici, seulement l'analyse et la conversion.
 */
import { CODE_CARNET_VERS_METHODE } from "../core/methodes";
import type { Match, Pari, Reglage, StatutPari } from "../core/types";
import { BANKROLL_PAR_DEFAUT, type Contenu } from "./contenu";

export class ErreurImport extends Error {}

export interface ControleCarnet {
  nbMatchs: number;
  matchsExemple: boolean;
  nbParis: number;
  nbParisTermines: number;
  gainsTotal: number;
  bankroll: number;
  /** Gains par code de méthode du carnet (m1, m2, m3, autre). */
  parMethode: Record<string, number>;
}

export interface AnalyseImportCarnet {
  format: "export-complet" | "ancienne-sauvegarde";
  exporteLe: string | null;
  /** Données converties au modèle de l'application, prêtes à être écrites. */
  contenu: Contenu;
  controle: ControleCarnet | null;
  /** Données brutes du carnet, conservées pour la vérification champ par champ. */
  source: {
    paris: Array<Record<string, unknown>>;
    matchs: Array<Record<string, unknown>>;
    reglages: { bank: number; pct: number } | null;
    competitions: string[] | null;
  };
  matchsExempleIgnores: number;
  avertissements: string[];
}

const STATUTS: readonly StatutPari[] = ["attente", "gagne", "perdu", "manuel", "rembourse"];

/** Extrait l'objet JSON d'un texte collé, même entouré d'autre texte. */
export function extraireJson(texte: string): unknown {
  const t = String(texte ?? "").trim();
  if (!t) throw new ErreurImport("La zone est vide : colle le texte de l'export.");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        /* message plus bas */
      }
    }
  }
  throw new ErreurImport(
    "Texte illisible : il est sans doute incomplet. Recopie tout le texte de l'export, du premier « { » au dernier « } ».",
  );
}

const normaliser = (s: unknown) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Identifiant d'un match sans id (même règle que le carnet : date|domicile|extérieur). */
export function cleMatch(m: Record<string, any>): string {
  return (m.date || "") + "|" + normaliser(m.domicile?.nom) + "|" + normaliser(m.exterieur?.nom);
}

/** Lecture d'un nombre comme le faisait le carnet (virgule acceptée) ; null si illisible. */
function nombre(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const x = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

export function analyserTexteCarnet(texte: string, maintenant: Date, nouvelId: () => string): AnalyseImportCarnet {
  const brut = extraireJson(texte) as Record<string, any>;
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) {
    throw new ErreurImport("Ce texte n'est pas un export du carnet.");
  }
  const avertissements: string[] = [];
  let format: AnalyseImportCarnet["format"];
  let parisBruts: unknown;
  let reglagesBruts: unknown;
  let matchsBruts: Record<string, any> | null = null;
  let competitions: unknown = null;
  let controle: ControleCarnet | null = null;
  let exporteLe: string | null = null;

  if (brut.app === "carnet-paris-foot" && brut.type === "export-complet") {
    if (brut.version !== 1) throw new ErreurImport(`Version d'export inconnue (${brut.version}). Mets l'application à jour.`);
    format = "export-complet";
    const cles = brut.cles ?? {};
    parisBruts = cles.paris ?? [];
    reglagesBruts = cles.reglages ?? null;
    matchsBruts = cles.matchs3 ?? null;
    competitions = cles.ligues3 ?? null;
    controle = brut.controle ?? null;
    exporteLe = typeof brut.exporteLe === "string" ? brut.exporteLe : null;
  } else if (Array.isArray(brut.paris)) {
    format = "ancienne-sauvegarde";
    parisBruts = brut.paris;
    reglagesBruts = brut.reglages ?? null;
    avertissements.push(
      "Ancienne sauvegarde : elle ne contient que les paris et les réglages, pas les matchs ni les compétitions. Utilise plutôt le bouton « Tout exporter » du carnet.",
    );
  } else if (brut.app === "carnet-foot" && brut.type === "sauvegarde") {
    throw new ErreurImport("C'est une sauvegarde de cette application : utilise « Restaurer une sauvegarde ».");
  } else {
    throw new ErreurImport("Ce texte n'est pas un export du carnet (ni « Tout exporter », ni « Copier ma sauvegarde »).");
  }

  if (!Array.isArray(parisBruts)) throw new ErreurImport("La liste des paris est illisible dans cet export.");
  const horodatage = maintenant.toISOString();

  // --- Paris ---
  const paris: Pari[] = [];
  const sourceParis: Array<Record<string, unknown>> = [];
  parisBruts.forEach((b: any, index: number) => {
    const n = index + 1;
    if (!b || typeof b !== "object") {
      avertissements.push(`Pari n° ${n} illisible : ignoré.`);
      return;
    }
    sourceParis.push(b);
    const methode = CODE_CARNET_VERS_METHODE[String(b.methode)];
    if (!methode) avertissements.push(`Pari n° ${n} : méthode « ${b.methode} » inconnue, classé dans « Autre ».`);
    const statut = STATUTS.includes(b.statut) ? (b.statut as StatutPari) : "attente";
    if (!STATUTS.includes(b.statut)) avertissements.push(`Pari n° ${n} : résultat « ${b.statut} » inconnu, classé « En cours ».`);
    const cote = nombre(b.cote);
    const mise = nombre(b.mise);
    if (cote === null) avertissements.push(`Pari n° ${n} : cote illisible, comptée 0 comme dans le carnet.`);
    if (mise === null) avertissements.push(`Pari n° ${n} : mise illisible, comptée 0 comme dans le carnet.`);
    const p: Pari = {
      id: nouvelId(),
      ordre: index,
      date: typeof b.date === "string" ? b.date : "",
      match: typeof b.match === "string" ? b.match : String(b.match ?? ""),
      methode: methode ?? "Autre",
      cote: cote ?? 0,
      mise: mise ?? 0,
      statut,
      creeLe: horodatage,
      modifieLe: horodatage,
      origine: { carnet: { index, methode: String(b.methode) } },
    };
    if (b.pnl !== undefined && b.pnl !== null) {
      const pnl = nombre(b.pnl);
      p.pnl = pnl ?? 0;
    }
    paris.push(p);
  });

  // --- Matchs ---
  const matchs: Match[] = [];
  const sourceMatchs: Array<Record<string, unknown>> = [];
  let matchsExempleIgnores = 0;
  if (matchsBruts && Array.isArray(matchsBruts.matchs)) {
    if (matchsBruts.exemple) {
      matchsExempleIgnores = matchsBruts.matchs.length;
    } else {
      const parId = new Map<string, Match>();
      matchsBruts.matchs.forEach((m: any, i: number) => {
        if (!m || typeof m !== "object" || !m.domicile?.nom || !m.exterieur?.nom) {
          avertissements.push(`Match n° ${i + 1} sans équipes : ignoré.`);
          return;
        }
        const copie = JSON.parse(JSON.stringify(m)) as Match;
        if (!copie.id) copie.id = cleMatch(copie);
        copie.id = String(copie.id);
        if (parId.has(copie.id)) avertissements.push(`Match « ${copie.id} » en double : la dernière version est gardée.`);
        parId.set(copie.id, copie);
      });
      for (const m of parId.values()) {
        matchs.push(m);
        sourceMatchs.push(m as Record<string, unknown>);
      }
    }
  }

  // --- Réglages ---
  const reglages: Reglage[] = [];
  let sourceReglages: { bank: number; pct: number } | null = null;
  const rb = reglagesBruts as Record<string, unknown> | null;
  if (rb && typeof rb === "object") {
    const bank = nombre(rb.bank);
    const pct = nombre(rb.pct);
    sourceReglages = { bank: bank ?? BANKROLL_PAR_DEFAUT.depart, pct: pct ?? BANKROLL_PAR_DEFAUT.pctMise };
    if (bank === null || pct === null) avertissements.push("Réglages de bankroll incomplets : valeurs par défaut du carnet utilisées (200 €, 2 %).");
  } else {
    sourceReglages = { bank: BANKROLL_PAR_DEFAUT.depart, pct: BANKROLL_PAR_DEFAUT.pctMise };
    avertissements.push("Pas de réglages de bankroll dans l'export : valeurs par défaut du carnet utilisées (200 €, 2 %).");
  }
  reglages.push({ cle: "bankroll", valeur: { depart: sourceReglages.bank, pctMise: sourceReglages.pct } });
  let sourceCompetitions: string[] | null = null;
  if (Array.isArray(competitions)) {
    sourceCompetitions = competitions.map(String);
    reglages.push({ cle: "competitions", valeur: [...sourceCompetitions] });
  }

  return {
    format,
    exporteLe,
    contenu: { matchs, paris, reglages },
    controle,
    source: { paris: sourceParis, matchs: sourceMatchs, reglages: sourceReglages, competitions: sourceCompetitions },
    matchsExempleIgnores,
    avertissements,
  };
}
