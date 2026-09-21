/**
 * Opérations complètes sur les données, avec leurs garde-fous :
 * copie de sécurité avant toute écriture, vérification après relecture,
 * retour automatique à l'état précédent si quelque chose ne correspond pas.
 */
import { amorcerSuivi, nouvellesAlertes, suivreCotes, type AlerteCote } from "../core/cotes";
import type { CotesMatch, Marche, Match, Resultat } from "../core/types";
import { contexteDepuisBase } from "./analyse";
import { estVide, jsonCanonique, resumer, type Contenu } from "./contenu";
import {
  ajouterVersion,
  ecrireMatchs,
  ecrireReglage,
  ecrireResultats,
  lireContenu,
  lireMatchs,
  lireReglage,
  lireResultats,
  lireVersion,
  listerVersions,
  remplacerContenu,
  supprimerGroupeResultats,
  supprimerVersions,
} from "./depot";
import { analyserCsv, comparerResultats, type AnalyseCsv, type ComparaisonResultats } from "./import-csv";
import { analyserImportMatchs, fusionProfonde, type AnalyseImportMatchs } from "./import-matchs";
import { analyserTexteCarnet, ErreurImport, type AnalyseImportCarnet } from "./import-carnet";
import { creerSauvegarde, lireSauvegarde, nomFichierSauvegarde } from "./sauvegarde";
import { verifierImportCarnet, type RapportVerification } from "./verification";
import { faireCopieDuJour, jourLocal, versionsASupprimer, type RaisonVersion, type Version } from "./versions";
import { empreinte } from "./contenu";

export const VERSION_APP: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

function nouvelId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

/** Crée une copie complète du contenu actuel dans l'historique, puis fait le ménage. */
export async function creerVersion(raison: RaisonVersion, contenu?: Contenu): Promise<Version | null> {
  const c = contenu ?? (await lireContenu());
  if (estVide(c) && raison !== "manuelle") return null;
  const maintenant = new Date();
  const v: Version = {
    id: maintenant.toISOString() + "-" + raison,
    creeLe: maintenant.toISOString(),
    jour: jourLocal(maintenant),
    raison,
    resume: resumer(c),
    contenu: c,
  };
  await ajouterVersion(v);
  await supprimerVersions(versionsASupprimer(await listerVersions()));
  return v;
}

/** Copie quotidienne automatique : au plus une par jour, seulement s'il y a des données. */
export async function assurerCopieDuJour(): Promise<Version | null> {
  const versions = await listerVersions();
  if (!faireCopieDuJour(versions, new Date())) return null;
  return creerVersion("quotidienne");
}

export interface ResultatImport {
  ok: boolean;
  analyse: AnalyseImportCarnet;
  /** Vérification de la conversion, avant toute écriture. */
  avant: RapportVerification;
  /** Vérification après écriture et relecture de la base (absente si rien n'a été écrit). */
  apres: RapportVerification | null;
  /** Vrai si l'état précédent a été remis en place après un écart. */
  retourArriere: boolean;
}

/** Première étape de l'import : analyse et vérification de la conversion, sans rien écrire. */
export function previsualiserImportCarnet(texte: string): { analyse: AnalyseImportCarnet; avant: RapportVerification } {
  const analyse = analyserTexteCarnet(texte, new Date(), nouvelId);
  return { analyse, avant: verifierImportCarnet(analyse, analyse.contenu) };
}

/**
 * Import depuis le carnet : remplace les données de l'application par celles du carnet.
 * Étapes : vérification de la conversion → copie de sécurité → écriture → relecture
 * et vérification → retour arrière automatique au moindre écart.
 */
export async function importerCarnet(analyse: AnalyseImportCarnet): Promise<ResultatImport> {
  const avant = verifierImportCarnet(analyse, analyse.contenu);
  if (!avant.ok) return { ok: false, analyse, avant, apres: null, retourArriere: false };

  const precedent = await lireContenu();
  await creerVersion("avant-import", precedent);
  // Le carnet fournit les matchs, les paris, la bankroll et les compétitions. Les réglages qu'il ne
  // connaît pas (thème, critères d'analyse, offres de freebet…) sont gardés : ils n'existent nulle
  // part ailleurs et ne doivent pas disparaître à chaque import.
  const conserves = precedent.reglages.filter((r) => !analyse.contenu.reglages.some((x) => x.cle === r.cle));
  await remplacerContenu({ ...analyse.contenu, reglages: [...analyse.contenu.reglages, ...conserves] });
  const relu = await lireContenu();
  const apres = verifierImportCarnet(analyse, relu);
  if (!apres.ok) {
    await remplacerContenu(precedent);
    return { ok: false, analyse, avant, apres, retourArriere: true };
  }
  await ecrireReglage("migrationCarnet", {
    le: new Date().toISOString(),
    format: analyse.format,
    exporteLe: analyse.exporteLe,
    nbParis: relu.paris.length,
    nbMatchs: relu.matchs.length,
  });
  await demanderStockagePersistant();
  return { ok: true, analyse, avant, apres, retourArriere: false };
}

/* ---------- Matchs (réponse de l'autre conversation Claude) ---------- */

/** Analyse de la réponse collée, comparée aux matchs déjà enregistrés. Rien n'est écrit. */
export function previsualiserImportMatchs(texte: string, existants: readonly Match[]): AnalyseImportMatchs {
  return analyserImportMatchs(texte, existants, new Date());
}

/**
 * Écrit des matchs après une copie de sécurité, relit la base et vérifie chaque match.
 * Au moindre écart, les matchs d'avant sont remis en place. Renvoie les alertes de cote nouvelles.
 */
async function ecrireMatchsVerifies(aEcrire: readonly Match[]): Promise<AlerteCote[]> {
  const ids = aEcrire.map((m) => m.id);
  const avant = await lireMatchs(ids);
  await ecrireMatchs(aEcrire);
  const relus = await lireMatchs(ids);
  const ok = relus.every((m, i) => m && jsonCanonique(m) === jsonCanonique(aEcrire[i]));
  if (!ok) {
    await ecrireMatchs(
      avant.filter((m): m is Match => !!m),
      ids.filter((_, i) => !avant[i]),
    );
    throw new ErreurImport("Les matchs ne se sont pas écrits correctement : l'état précédent a été remis en place.");
  }
  return nouvellesAlertes(avant.filter((m): m is Match => !!m), aEcrire, await contexteDepuisBase());
}

export interface ResultatImportMatchs {
  ecrits: number;
  alertes: AlerteCote[];
}

export async function importerMatchs(analyse: AnalyseImportMatchs): Promise<ResultatImportMatchs> {
  if (!analyse.aEcrire.length) return { ecrits: 0, alertes: [] };
  await creerVersion("avant-import");
  const alertes = await ecrireMatchsVerifies(analyse.aEcrire);
  await demanderStockagePersistant();
  return { ecrits: analyse.aEcrire.length, alertes };
}

async function lireMatch(id: string): Promise<Match> {
  const [m] = await lireMatchs([id]);
  if (!m) throw new ErreurImport("Ce match n'existe plus.");
  return m;
}

/**
 * Cotes ressaisies à la main : une case vide garde la cote précédente.
 * Un relevé daté est ajouté au suivi si les cotes changent.
 */
export async function enregistrerCotes(id: string, saisie: CotesMatch): Promise<AlerteCote[]> {
  const m = await lireMatch(id);
  const cotes = fusionProfonde({ ...(m.cotes ?? {}) } as Record<string, unknown>, saisie as Record<string, unknown>) as CotesMatch;
  const apres = suivreCotes({ ...amorcerSuivi(m), cotes }, new Date().toISOString(), "saisie");
  return ecrireMatchsVerifies([apres]);
}

/** Cote minimale choisie à la main pour un marché (null : revenir à la cote mini calculée). */
export async function definirCoteMinimale(id: string, marche: Marche, valeur: number | null): Promise<AlerteCote[]> {
  const m = await lireMatch(id);
  const coteCible = { ...(m.coteCible ?? {}), [marche]: valeur };
  return ecrireMatchsVerifies([{ ...m, coteCible }]);
}

/* ---------- Historiques de résultats (CSV football-data) ---------- */

export interface ApercuCsv {
  analyse: AnalyseCsv;
  comparaison: ComparaisonResultats;
}

export async function previsualiserCsv(texte: string): Promise<ApercuCsv> {
  const analyse = analyserCsv(texte);
  const existants = new Map((await lireResultats()).map((r) => [r.id, jsonCanonique(r)]));
  return { analyse, comparaison: comparerResultats(analyse.resultats, existants) };
}

/** Enregistre les résultats puis vérifie qu'ils sont tous relus à l'identique. */
export async function importerResultats(rs: readonly Resultat[]): Promise<number> {
  await ecrireResultats(rs);
  const relus = new Map((await lireResultats()).map((r) => [r.id, jsonCanonique(r)]));
  const manquants = rs.filter((r) => relus.get(r.id) !== jsonCanonique(r));
  if (manquants.length) throw new ErreurImport(`${manquants.length} résultats ne se sont pas écrits correctement. Réessaie l'import.`);
  await demanderStockagePersistant();
  return rs.length;
}

export { lireResultats, supprimerGroupeResultats };

export interface FichierPret {
  nom: string;
  texte: string;
}

/** Prépare le fichier de sauvegarde complet. */
export async function preparerSauvegarde(): Promise<FichierPret> {
  const maintenant = new Date();
  const f = await creerSauvegarde(await lireContenu(), VERSION_APP, maintenant);
  return { nom: nomFichierSauvegarde(maintenant), texte: JSON.stringify(f, null, 1) };
}

/** À appeler quand le fichier a bien été enregistré, partagé ou copié. */
export async function noterExportFichier(): Promise<void> {
  await ecrireReglage("dernierExportFichier", new Date().toISOString());
}

export async function dateDernierExport(): Promise<Date | null> {
  const v = await lireReglage<string>("dernierExportFichier");
  return v ? new Date(v) : null;
}

/** Restaure une sauvegarde (fichier ou texte) après une copie de sécurité ; vérifie l'empreinte après relecture. */
export async function restaurerSauvegarde(texte: string): Promise<{ resume: ReturnType<typeof resumer> }> {
  const lue = await lireSauvegarde(texte);
  const precedent = await lireContenu();
  await creerVersion("avant-restauration", precedent);
  await remplacerContenu(lue.contenu);
  const relu = await lireContenu();
  if ((await empreinte(relu)) !== lue.empreinte) {
    await remplacerContenu(precedent);
    throw new ErreurImport("La restauration ne s'est pas écrite correctement : l'état précédent a été remis en place.");
  }
  return { resume: lue.resume };
}

/** Revient à une version de l'historique (après une copie de sécurité de l'état actuel). */
export async function restaurerVersion(id: string): Promise<Version> {
  const v = await lireVersion(id);
  if (!v) throw new ErreurImport("Cette version n'existe plus.");
  const precedent = await lireContenu();
  await creerVersion("avant-restauration", precedent);
  await remplacerContenu(v.contenu);
  const relu = await lireContenu();
  if ((await empreinte(relu)) !== (await empreinte(v.contenu))) {
    await remplacerContenu(precedent);
    throw new ErreurImport("La restauration ne s'est pas écrite correctement : l'état précédent a été remis en place.");
  }
  return v;
}

export interface EtatStockage {
  persistant: boolean | null;
  utiliseOctets: number | null;
  quotaOctets: number | null;
}

/** Demande au navigateur de ne pas effacer les données en cas de manque de place. */
export async function demanderStockagePersistant(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function etatStockage(): Promise<EtatStockage> {
  const etat: EtatStockage = { persistant: null, utiliseOctets: null, quotaOctets: null };
  try {
    if (navigator.storage?.persisted) etat.persistant = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      etat.utiliseOctets = e.usage ?? null;
      etat.quotaOctets = e.quota ?? null;
    }
  } catch {
    /* informations indisponibles */
  }
  return etat;
}
