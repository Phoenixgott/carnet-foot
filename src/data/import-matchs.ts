/**
 * Import des matchs envoyés par l'autre conversation Claude (réponse JSON à la demande).
 *
 * Étapes, sans rien écrire (fonctions pures) :
 *  1. extraction : le ou les blocs JSON de la réponse, même entourés de texte
 *     (même tolérance que le carnet : virgules en trop, guillemets typographiques) ;
 *  2. validation champ par champ : une valeur impossible (ex. 150 %) est écartée,
 *     signalée, et affichée ⏳ — jamais corrigée ni inventée ;
 *  3. doublons : un match déjà présent (même id, ou même date et mêmes équipes)
 *     est fusionné au lieu d'être ajouté deux fois ;
 *  4. fusion intelligente (celle du carnet) : une info reçue remplace l'ancienne,
 *     une info absente ou null ne l'efface jamais ;
 *  5. suivi des cotes : si les cotes changent, un relevé daté est ajouté.
 */
import { amorcerSuivi, memesCotes, releveDe, suivreCotes } from "../core/cotes";
import { estNombre } from "../core/format";
import type { Match } from "../core/types";
import { jsonCanonique } from "./contenu";
import { cleMatch, ErreurImport } from "./import-carnet";

/* ------------------------------------------------------------------ */
/* 1. Extraction                                                       */

export interface Extraction {
  matchs: unknown[];
  /** La réponse annonce une suite (« SUITE DISPONIBLE »). */
  suiteDisponible: boolean;
}

/** Lit la réponse collée : blocs ```json, ou le texte entier (le `extractAll` du carnet). */
export function extraireMatchs(texte: string): Extraction {
  const t = String(texte ?? "").trim();
  if (!t) throw new ErreurImport("La zone est vide : colle la réponse de Claude.");
  const blocs = [...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((x) => x[1].trim());
  const candidats = blocs.length ? blocs : [t];
  const objets: unknown[] = [];
  for (const s of candidats) {
    let o: unknown = null;
    try {
      o = JSON.parse(s);
    } catch {
      const a = s.indexOf("{");
      const b = s.lastIndexOf("}");
      if (a >= 0 && b > a) {
        const c = s.slice(a, b + 1);
        try {
          o = JSON.parse(c);
        } catch {
          try {
            o = JSON.parse(c.replace(/,\s*([}\]])/g, "$1").replace(/[“”]/g, '"'));
          } catch {
            /* illisible */
          }
        }
      }
    }
    if (o) objets.push(o);
  }
  if (!objets.length) {
    throw new ErreurImport("Je ne trouve pas de données lisibles. Copie bien toute la réponse de Claude, avec le bloc de code.");
  }
  for (const o of objets) {
    const app = (o as Record<string, unknown>)?.app;
    if (app === "carnet-paris-foot") throw new ErreurImport("C'est un export du carnet : colle-le dans l'onglet « Données », « Importer depuis le carnet ».");
    if (app === "carnet-foot") throw new ErreurImport("C'est une sauvegarde de l'application : utilise « Restaurer une sauvegarde » dans l'onglet « Données ».");
  }
  const matchs = objets.flatMap((o: any) => (Array.isArray(o) ? o : Array.isArray(o?.matchs) ? o.matchs : []));
  return { matchs, suiteDisponible: /SUITE DISPONIBLE/i.test(t) };
}

/* ------------------------------------------------------------------ */
/* 2. Validation                                                       */

const LIBELLES: Readonly<Record<string, string>> = {
  date: "date",
  heure: "heure",
  moyenneButsLigue: "moyenne de buts de la compétition",
  joues: "matchs joués",
  marques: "buts marqués",
  encaisses: "buts encaissés",
  pctOver15: "% de matchs à 2+ buts",
  pctOver25: "% de matchs à 3+ buts",
  derniersButsMarques: "derniers matchs",
  "h2h.joues": "confrontations directes jouées",
  "h2h.over25": "confrontations directes à 3+ buts",
  "cotes.over15": "cote plus de 1,5",
  "cotes.under15": "cote moins de 1,5",
  "cotes.over25": "cote plus de 2,5",
  "cotes.under25": "cote moins de 2,5",
  "cotes.bookmaker": "bookmaker",
  selection: "sélections",
  feminin: "féminin",
  absenceOffensive: "attaquant absent",
  meilleurButeurAbsent: "meilleur buteur absent",
  defenseAffaiblie: "défense affaiblie",
  absents: "absents",
  contexte: "contexte",
  ligue: "compétition",
  journee: "journée",
  manquants: "infos manquantes",
  sources: "sources",
};

/** Libellé lisible d'un champ (« domicile.pctOver15 » → « % de matchs à 2+ buts (Lens) »). */
export function libelleChamp(chemin: string, m?: Match): string {
  const [tete, ...reste] = chemin.split(".");
  if ((tete === "domicile" || tete === "exterieur") && reste.length) {
    const equipe = (tete === "domicile" ? m?.domicile?.nom : m?.exterieur?.nom) || tete;
    const champ = reste.join(".");
    return champ === "nom" ? `nom (${tete})` : `${LIBELLES[champ] ?? champ} (${equipe})`;
  }
  return LIBELLES[chemin] ?? chemin;
}

const CONTEXTES = ["normal", "finale", "derby", "maintien", "montee", "sans_enjeu", "retour_coupe_retard"];

/** Nombre lu tel quel ou depuis un texte « 2,85 » ; undefined si ce n'est pas un nombre. */
function lireNombre(v: unknown): number | undefined {
  if (estNombre(v)) return v;
  if (typeof v === "string" && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return Number(v.trim().replace(",", "."));
  return undefined;
}

interface Regle {
  min: number;
  max: number;
  entier?: boolean;
  /** Borne basse exclue (cotes : strictement plus de 1). */
  minExclu?: boolean;
}

const REGLE_EQUIPE: Readonly<Record<string, Regle>> = {
  joues: { min: 0, max: 100, entier: true },
  marques: { min: 0, max: 400, entier: true },
  encaisses: { min: 0, max: 400, entier: true },
  pctOver15: { min: 0, max: 100 },
  pctOver25: { min: 0, max: 100 },
};
const REGLE_COTE: Regle = { min: 1, max: 1000, minExclu: true };

export interface MatchNettoye {
  match: Match | null;
  avertissements: string[];
}

/**
 * Vérifie un match reçu. Les valeurs impossibles sont remplacées par null (⏳) et signalées ;
 * les champs inconnus sont gardés tels quels. Un match sans ses deux équipes est refusé.
 */
export function nettoyerMatch(brut: unknown, position: number): MatchNettoye {
  const avertissements: string[] = [];
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) {
    return { match: null, avertissements: [`Élément n° ${position} : ce n'est pas un match, ignoré.`] };
  }
  const m = JSON.parse(JSON.stringify(brut)) as Match & Record<string, any>;
  const nomDe = (e: any) => (e && typeof e === "object" && typeof e.nom === "string" ? e.nom.trim() : "");
  const dom = nomDe(m.domicile);
  const ext = nomDe(m.exterieur);
  if (!dom || !ext) {
    return { match: null, avertissements: [`Match n° ${position} sans ses deux équipes : ignoré.`] };
  }
  m.domicile!.nom = dom;
  m.exterieur!.nom = ext;
  const titre = `${dom} – ${ext}`;
  const ecarter = (chemin: string, valeur: unknown, attendu: string) =>
    avertissements.push(`${titre} : ${libelleChamp(chemin, m)} vaut ${JSON.stringify(valeur)} (${attendu}) : ignoré, affiché ⏳.`);

  // Champs propres à l'application : jamais repris d'une réponse.
  delete m.historiqueCotes;
  delete m.coteCible;

  // Date et heure (avant l'identifiant, qui peut en dépendre)
  if (m.date !== null && m.date !== undefined) {
    const s = String(m.date).trim();
    const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    const iso = fr ? `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}` : s;
    const d = new Date(iso + "T12:00:00Z");
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso) m.date = iso;
    else {
      ecarter("date", m.date, "attendu AAAA-MM-JJ");
      m.date = null;
    }
  }
  if (m.heure !== null && m.heure !== undefined) {
    const h = /^(\d{1,2})\s*[:hH]\s*(\d{2})$/.exec(String(m.heure).trim());
    if (h && Number(h[1]) < 24 && Number(h[2]) < 60) m.heure = `${h[1].padStart(2, "0")}:${h[2]}`;
    else {
      ecarter("heure", m.heure, "attendu HH:MM");
      m.heure = null;
    }
  }

  // Identifiant : celui reçu, sinon date|domicile|extérieur (règle du carnet)
  if (m.id === null || m.id === undefined || m.id === "") m.id = cleMatch(m);
  m.id = String(m.id);

  // Nombres
  const verifierNombre = (objet: Record<string, any>, cle: string, chemin: string, r: Regle) => {
    const v = objet[cle];
    if (v === null || v === undefined) return;
    const x = lireNombre(v);
    const dedans = x !== undefined && (r.minExclu ? x > r.min : x >= r.min) && x <= r.max && (!r.entier || Number.isInteger(x));
    if (dedans) objet[cle] = x;
    else {
      ecarter(chemin, v, x === undefined ? "ce n'est pas un nombre" : `attendu ${r.entier ? "un entier " : ""}de ${r.min} à ${r.max}`);
      objet[cle] = null;
    }
  };
  verifierNombre(m, "moyenneButsLigue", "moyenneButsLigue", { min: 0, max: 10 });
  for (const cote of ["domicile", "exterieur"] as const) {
    const e = m[cote] as Record<string, any>;
    for (const [cle, r] of Object.entries(REGLE_EQUIPE)) verifierNombre(e, cle, `${cote}.${cle}`, r);
    const l = e.derniersButsMarques;
    if (l !== null && l !== undefined) {
      if (!Array.isArray(l)) {
        ecarter(`${cote}.derniersButsMarques`, l, "attendu une liste de buts");
        e.derniersButsMarques = null;
      } else {
        e.derniersButsMarques = l.map((b: unknown) => {
          if (b === null) return null;
          const x = lireNombre(b);
          if (x !== undefined && Number.isInteger(x) && x >= 0 && x <= 20) return x;
          ecarter(`${cote}.derniersButsMarques`, b, "attendu un nombre de buts");
          return null;
        });
      }
    }
  }
  if (m.h2h !== null && m.h2h !== undefined) {
    if (typeof m.h2h !== "object" || Array.isArray(m.h2h)) {
      ecarter("h2h.joues", m.h2h, "attendu { joues, over25 }");
      m.h2h = null;
    } else {
      const h = m.h2h as Record<string, any>;
      verifierNombre(h, "joues", "h2h.joues", { min: 0, max: 50, entier: true });
      verifierNombre(h, "over25", "h2h.over25", { min: 0, max: estNombre(h.joues) ? h.joues : 50, entier: true });
    }
  }
  if (m.cotes !== null && m.cotes !== undefined) {
    if (typeof m.cotes !== "object" || Array.isArray(m.cotes)) {
      ecarter("cotes.over15", m.cotes, "attendu { over15, over25… }");
      m.cotes = null;
    } else {
      const c = m.cotes as Record<string, any>;
      for (const cle of ["over15", "under15", "over25", "under25"]) verifierNombre(c, cle, `cotes.${cle}`, REGLE_COTE);
      if (c.bookmaker !== null && c.bookmaker !== undefined && typeof c.bookmaker !== "string") {
        ecarter("cotes.bookmaker", c.bookmaker, "attendu un nom");
        c.bookmaker = null;
      }
    }
  }

  // Oui / non
  for (const cle of ["selection", "feminin", "absenceOffensive", "meilleurButeurAbsent", "defenseAffaiblie"]) {
    const v = m[cle];
    if (v === null || v === undefined || typeof v === "boolean") continue;
    const s = String(v).trim().toLowerCase();
    if (s === "true" || s === "oui") m[cle] = true;
    else if (s === "false" || s === "non") m[cle] = false;
    else {
      ecarter(cle, v, "attendu true ou false");
      m[cle] = null;
    }
  }

  // Listes de textes
  for (const cle of ["absents", "manquants", "sources"]) {
    const v = m[cle];
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) m[cle] = v.filter((x) => x !== null && x !== undefined).map(String);
    else if (typeof v === "string") m[cle] = v.trim() ? [v.trim()] : [];
    else {
      ecarter(cle, v, "attendu une liste");
      m[cle] = null;
    }
  }

  // Contexte : valeur inconnue gardée (comme le carnet), mais signalée
  if (typeof m.contexte === "string" && m.contexte && !CONTEXTES.includes(m.contexte)) {
    avertissements.push(`${titre} : contexte « ${m.contexte} » inconnu (attendu : ${CONTEXTES.join(", ")}).`);
  }

  return { match: m, avertissements };
}

/* ------------------------------------------------------------------ */
/* 3-4. Doublons et fusion                                             */

const objetSimple = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Fusion du carnet (`deepMerge`) : une valeur reçue remplace l'ancienne,
 * sauf si elle est null ou absente ; les sous-objets sont fusionnés, les listes remplacées.
 */
export function fusionProfonde<T extends Record<string, unknown>>(a: T, b: Record<string, unknown>): T {
  const r: Record<string, unknown> = { ...a };
  for (const k in b) {
    const v = b[k];
    if (v === null || v === undefined) continue;
    r[k] = objetSimple(v) && objetSimple(a?.[k]) ? fusionProfonde(a[k] as Record<string, unknown>, v) : v;
  }
  return r as T;
}

/** Fusionne un match reçu dans un match existant ; l'identifiant existant est gardé. */
export function fusionnerMatch(existant: Match, recu: Match): Match {
  return { ...fusionProfonde(existant, recu), id: existant.id };
}

/** Chemins des valeurs différentes entre deux matchs (hors suivi des cotes). */
export function champsModifies(avant: Match, apres: Match): string[] {
  const sortie: string[] = [];
  const parcourir = (a: unknown, b: unknown, chemin: string) => {
    if (objetSimple(a) && objetSimple(b)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) parcourir(a[k], b[k], chemin ? `${chemin}.${k}` : k);
    } else if (jsonCanonique(a ?? null) !== jsonCanonique(b ?? null)) {
      sortie.push(chemin);
    }
  };
  const sans = (m: Match) => {
    const { historiqueCotes: _h, ...reste } = m;
    return reste;
  };
  parcourir(sans(avant), sans(apres), "");
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Analyse complète                                                    */

export interface MiseAJourMatch {
  avant: Match;
  apres: Match;
  /** Libellés lisibles des champs modifiés. */
  champs: string[];
  /** Les cotes ont changé : un relevé a été ajouté au suivi. */
  cotesChangees: boolean;
}

export interface AnalyseImportMatchs {
  nbRecus: number;
  nouveaux: Match[];
  misAJour: MiseAJourMatch[];
  /** Matchs déjà présents, sans aucune info nouvelle. */
  inchanges: Match[];
  /** Éléments refusés (sans équipes, illisibles). */
  ignores: string[];
  avertissements: string[];
  suiteDisponible: boolean;
  /** Matchs à écrire (nouveaux et mis à jour), dans leur état final. */
  aEcrire: Match[];
}

const aCotes = (m: Match) => releveDe(m.cotes, null, "import");

export function analyserImportMatchs(texte: string, existants: readonly Match[], maintenant: Date): AnalyseImportMatchs {
  const { matchs: bruts, suiteDisponible } = extraireMatchs(texte);
  const le = maintenant.toISOString();
  const ignores: string[] = [];
  const avertissements: string[] = [];

  // Validation, puis regroupement des doublons à l'intérieur de la réponse.
  const recus: Match[] = [];
  bruts.forEach((b, i) => {
    const { match, avertissements: av } = nettoyerMatch(b, i + 1);
    if (!match) {
      ignores.push(...av);
      return;
    }
    avertissements.push(...av);
    const j = recus.findIndex((x) => x.id === match.id || cleMatch(x) === cleMatch(match));
    if (j >= 0) {
      avertissements.push(`${match.domicile?.nom} – ${match.exterieur?.nom} apparaît deux fois dans la réponse : les deux versions sont fusionnées.`);
      recus[j] = fusionnerMatch(recus[j], match);
    } else recus.push(match);
  });

  const nouveaux: Match[] = [];
  const misAJour: MiseAJourMatch[] = [];
  const inchanges: Match[] = [];
  const dejaVus = new Set<string>();

  for (const recu of recus) {
    const existant = existants.find((x) => x.id === recu.id || cleMatch(x) === cleMatch(recu));
    if (!existant) {
      nouveaux.push(suivreCotes(recu, le, "import"));
      continue;
    }
    if (dejaVus.has(existant.id)) continue;
    dejaVus.add(existant.id);
    const fusion = fusionnerMatch(existant, recu);
    const cotesChangees = !memesCotes(aCotes(existant), aCotes(fusion));
    const apres = cotesChangees ? suivreCotes(fusionnerMatch(amorcerSuivi(existant), recu), le, "import") : fusion;
    const champs = champsModifies(existant, apres);
    if (!champs.length) inchanges.push(existant);
    else misAJour.push({ avant: existant, apres, champs: [...new Set(champs.map((c) => libelleChamp(c, apres)))], cotesChangees });
  }

  return {
    nbRecus: bruts.length,
    nouveaux,
    misAJour,
    inchanges,
    ignores,
    avertissements,
    suiteDisponible,
    aEcrire: [...nouveaux, ...misAJour.map((x) => x.apres)],
  };
}
