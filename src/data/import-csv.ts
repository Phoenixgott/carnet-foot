/**
 * Import des historiques de football-data.co.uk (fichiers CSV de résultats).
 *
 * Deux présentations de fichiers existent sur le site :
 *  - grands championnats (E0.csv, F1.csv…) : colonnes Div, Date, Time, HomeTeam, AwayTeam,
 *    FTHG, FTAG, HTHG, HTAG et des cotes (dont plus/moins de 2,5 buts) ;
 *  - autres championnats (ARG.csv, USA.csv…) : Country, League, Season, Date, Time, Home, Away, HG, AG.
 * Les matchs pas encore joués (score vide) sont ignorés. Aucun score n'est deviné.
 * Fonctions pures : aucune écriture ici.
 */
import { saisonDe } from "../core/saison";
import type { Resultat } from "../core/types";
import { jsonCanonique } from "./contenu";
import { ErreurImport } from "./import-carnet";

/** Codes de division de football-data → nom du championnat. */
export const DIVISIONS: Readonly<Record<string, string>> = {
  E0: "Premier League",
  E1: "Championship",
  E2: "League One",
  E3: "League Two",
  EC: "National League",
  SC0: "Premiership (Écosse)",
  SC1: "Championship (Écosse)",
  D1: "Bundesliga",
  D2: "2. Bundesliga",
  I1: "Serie A",
  I2: "Serie B",
  SP1: "LaLiga",
  SP2: "LaLiga 2",
  F1: "Ligue 1",
  F2: "Ligue 2",
  N1: "Eredivisie",
  B1: "Jupiler Pro League",
  P1: "Liga Portugal",
  T1: "Süper Lig",
  G1: "Super League (Grèce)",
};

/** Découpe un CSV (séparateur virgule ou point-virgule, champs entre guillemets acceptés). */
export function lireCsv(texte: string): string[][] {
  const t = String(texte ?? "").replace(/^\uFEFF/, "");
  const premiere = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (premiere.match(/;/g)?.length ?? 0) > (premiere.match(/,/g)?.length ?? 0) ? ";" : ",";
  const lignes: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else champ += c;
  }
  if (champ !== "" || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes.filter((l) => l.some((x) => x.trim() !== ""));
}

/** Date du fichier (JJ/MM/AA ou JJ/MM/AAAA) → AAAA-MM-JJ ; null si illisible. */
export function dateCsv(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s.trim());
  if (!m) return null;
  let annee = Number(m[3]);
  if (m[3].length === 2) annee += annee < 70 ? 2000 : 1900;
  const iso = `${annee}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(iso + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

const entier = (s: string | undefined): number | null => (s !== undefined && /^\s*\d+\s*$/.test(s) ? Number(s) : null);
const cote = (s: string | undefined): number | null => {
  if (s === undefined || !/^\s*\d+(\.\d+)?\s*$/.test(s)) return null;
  const x = Number(s);
  return x > 1 ? x : null;
};

/** Paires de colonnes plus/moins de 2,5 buts, de la plus représentative à la moins. */
const COTES_25: ReadonlyArray<[string, string, string]> = [
  ["AvgC>2.5", "AvgC<2.5", "moyenne du marché (clôture)"],
  ["Avg>2.5", "Avg<2.5", "moyenne du marché"],
  ["BbAv>2.5", "BbAv<2.5", "moyenne du marché"],
  ["B365C>2.5", "B365C<2.5", "Bet365 (clôture)"],
  ["B365>2.5", "B365<2.5", "Bet365"],
  ["P>2.5", "P<2.5", "Pinnacle"],
];

const normaliser = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function idResultat(division: string, date: string, domicile: string, exterieur: string): string {
  return `${division}|${date}|${normaliser(domicile)}|${normaliser(exterieur)}`;
}

export interface GroupeResultats {
  /** Division + saison. */
  cle: string;
  division: string;
  championnat: string;
  saison: string;
  nb: number;
  du: string;
  au: string;
  /** Moyenne de buts par match. */
  moyenneButs: number;
  /** Part des matchs à 2 buts ou plus, et à 3 buts ou plus (0-1). */
  partPlus15: number;
  partPlus25: number;
}

/** Résumé par championnat et par saison. */
export function resumerResultats(resultats: readonly Resultat[]): GroupeResultats[] {
  const groupes = new Map<string, Resultat[]>();
  for (const r of resultats) {
    const cle = `${r.division}|${r.saison}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), r]);
  }
  return [...groupes.entries()]
    .map(([cle, rs]) => {
      const buts = rs.map((r) => r.butsDomicile + r.butsExterieur);
      const dates = rs.map((r) => r.date).sort();
      return {
        cle,
        division: rs[0].division,
        championnat: rs[0].championnat,
        saison: rs[0].saison,
        nb: rs.length,
        du: dates[0],
        au: dates[dates.length - 1],
        moyenneButs: buts.reduce((s, x) => s + x, 0) / rs.length,
        partPlus15: buts.filter((b) => b >= 2).length / rs.length,
        partPlus25: buts.filter((b) => b >= 3).length / rs.length,
      };
    })
    .sort((a, b) => a.championnat.localeCompare(b.championnat, "fr") || b.saison.localeCompare(a.saison));
}

export interface AnalyseCsv {
  resultats: Resultat[];
  /** Lignes écartées, avec leur raison (numéro de ligne du fichier). */
  ignorees: string[];
  /** Matchs sans score : pas encore joués. */
  nbPasJoues: number;
  /** Même match présent deux fois dans le fichier. */
  nbDoublonsFichier: number;
  groupes: GroupeResultats[];
}

export function analyserCsv(texte: string): AnalyseCsv {
  const lignes = lireCsv(texte);
  if (lignes.length < 2) throw new ErreurImport("Fichier vide ou illisible : choisis un fichier .csv de football-data.co.uk.");
  const entetes = lignes[0].map((x) => x.trim());
  const col = (nom: string) => entetes.indexOf(nom);
  const format = col("HomeTeam") >= 0 ? "principal" : col("Home") >= 0 ? "autre" : null;
  if (!format) {
    throw new ErreurImport("Ce fichier ne ressemble pas à un fichier de football-data.co.uk (il faut les colonnes HomeTeam/AwayTeam ou Home/Away).");
  }
  const c = {
    div: col("Div"),
    league: col("League"),
    country: col("Country"),
    date: col("Date"),
    heure: col("Time"),
    dom: col(format === "principal" ? "HomeTeam" : "Home"),
    ext: col(format === "principal" ? "AwayTeam" : "Away"),
    bd: col(format === "principal" ? "FTHG" : "HG"),
    be: col(format === "principal" ? "FTAG" : "AG"),
    mtd: col("HTHG"),
    mte: col("HTAG"),
  };
  if (c.date < 0) throw new ErreurImport("Colonne « Date » introuvable dans ce fichier.");
  if (c.bd < 0 || c.be < 0) throw new ErreurImport("Colonnes de score introuvables dans ce fichier (FTHG/FTAG ou HG/AG).");
  const paireCotes = COTES_25.map(([o, u, source]) => ({ o: col(o), u: col(u), source })).filter((p) => p.o >= 0 && p.u >= 0);

  const parId = new Map<string, Resultat>();
  const ignorees: string[] = [];
  let nbPasJoues = 0;
  let nbDoublonsFichier = 0;
  lignes.slice(1).forEach((l, i) => {
    const n = i + 2;
    const v = (k: number) => (k >= 0 ? (l[k] ?? "").trim() : "");
    const domicile = v(c.dom);
    const exterieur = v(c.ext);
    if (!domicile || !exterieur) {
      ignorees.push(`Ligne ${n} : équipes manquantes.`);
      return;
    }
    const date = dateCsv(v(c.date));
    if (!date) {
      ignorees.push(`Ligne ${n} (${domicile} – ${exterieur}) : date « ${v(c.date)} » illisible.`);
      return;
    }
    const bd = entier(v(c.bd));
    const be = entier(v(c.be));
    if (bd === null || be === null) {
      if (!v(c.bd) && !v(c.be)) nbPasJoues++;
      else ignorees.push(`Ligne ${n} (${domicile} – ${exterieur}) : score « ${v(c.bd)}-${v(c.be)} » illisible.`);
      return;
    }
    const division = v(c.div) || [v(c.country), v(c.league)].filter(Boolean).join(" ") || "?";
    const championnat = DIVISIONS[division] ?? (format === "autre" ? [v(c.league), v(c.country) && `(${v(c.country)})`].filter(Boolean).join(" ") : division);
    let cotes: Resultat["cotes"] = null;
    for (const p of paireCotes) {
      const o = cote(v(p.o));
      const u = cote(v(p.u));
      if (o !== null || u !== null) {
        cotes = { over25: o, under25: u, source: p.source };
        break;
      }
    }
    const heure = /^\d{1,2}:\d{2}$/.test(v(c.heure)) ? v(c.heure).padStart(5, "0") : null;
    const r: Resultat = {
      id: idResultat(division, date, domicile, exterieur),
      division,
      championnat,
      saison: saisonDe(date),
      date,
      heure,
      domicile,
      exterieur,
      butsDomicile: bd,
      butsExterieur: be,
      butsMiTempsDomicile: entier(v(c.mtd)),
      butsMiTempsExterieur: entier(v(c.mte)),
      cotes,
    };
    if (parId.has(r.id)) nbDoublonsFichier++;
    parId.set(r.id, r);
  });

  const resultats = [...parId.values()];
  if (!resultats.length && !nbPasJoues) throw new ErreurImport("Aucun match lisible dans ce fichier.");
  return { resultats, ignorees, nbPasJoues, nbDoublonsFichier, groupes: resumerResultats(resultats) };
}

export interface ComparaisonResultats {
  nouveaux: number;
  /** Déjà présents avec un contenu différent (ex. score corrigé, cotes ajoutées) : remplacés. */
  modifies: number;
  identiques: number;
}

/** Compare avec les historiques déjà enregistrés (id → JSON canonique) : doublons entre fichiers. */
export function comparerResultats(recus: readonly Resultat[], existants: ReadonlyMap<string, string>): ComparaisonResultats {
  let nouveaux = 0;
  let modifies = 0;
  let identiques = 0;
  for (const r of recus) {
    const e = existants.get(r.id);
    if (e === undefined) nouveaux++;
    else if (e === jsonCanonique(r)) identiques++;
    else modifies++;
  }
  return { nouveaux, modifies, identiques };
}
