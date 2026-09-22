/**
 * Opérations complètes sur les données, avec leurs garde-fous :
 * copie de sécurité avant toute écriture, vérification après relecture,
 * retour automatique à l'état précédent si quelque chose ne correspond pas.
 */
import { amorcerSuivi, nouvellesAlertes, suivreCotes, type AlerteCote } from "../core/cotes";
import type { CotesMatch, Marche, Match, Pari, ReglagesBankroll, Resultat } from "../core/types";
import { contexteDepuisBase } from "./analyse";
import { bankrollChoisie, bankrollDe, estVide, jsonCanonique, resumer, type Contenu } from "./contenu";
import {
  ajouterVersion,
  ecrireMatchs,
  ecrirePhotoTicket,
  ecrireParis,
  ecrireReglage,
  ecrireResultats,
  lireContenu,
  lireMatchs,
  lireParis,
  lirePhotoTicket,
  lireReglage,
  lireResultats,
  lireVersion,
  listerVersions,
  remplacerContenu,
  supprimerGroupeResultats,
  supprimerPhotoTicket,
  supprimerVersions,
  type PhotoTicket,
} from "./depot";
import { analyserCsv, comparerResultats, type AnalyseCsv, type ComparaisonResultats } from "./import-csv";
import { analyserImportMatchs, fusionnerMatchsAvecExistants, fusionProfonde, type AnalyseImportMatchs, type FusionMatchs } from "./import-matchs";
import { analyserTexteCarnet, ErreurImport, fusionnerParisCarnet, type AnalyseImportCarnet, type FusionParisCarnet } from "./import-carnet";
import { creerSauvegarde, lireSauvegarde, nomFichierSauvegarde } from "./sauvegarde";
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

export interface ApercuImportCarnet {
  analyse: AnalyseImportCarnet;
  matchs: FusionMatchs;
  paris: FusionParisCarnet;
  /** Bankroll déjà choisie dans l'application : elle est gardée, celle du carnet n'est pas reprise. */
  bankrollGardee: ReglagesBankroll | null;
}

/**
 * Première étape de l'import : analyse du texte, puis ce qui est nouveau par rapport à
 * l'application (matchs et paris déjà connus ne sont jamais écrasés). Rien n'est écrit.
 */
export async function previsualiserImportCarnet(texte: string): Promise<ApercuImportCarnet> {
  const maintenant = new Date();
  const analyse = analyserTexteCarnet(texte, maintenant, nouvelId);
  const existant = await lireContenu();
  const matchs = fusionnerMatchsAvecExistants(analyse.contenu.matchs, existant.matchs, maintenant.toISOString());
  const paris = fusionnerParisCarnet(analyse.contenu.paris, existant.paris);
  return { analyse, matchs, paris, bankrollGardee: bankrollChoisie(existant) ? bankrollDe(existant) : null };
}

/** Les deux réglages que le carnet connaît et continue d'alimenter à chaque import. */
const CLES_REGLAGES_CARNET: readonly string[] = ["bankroll", "competitions"];

export interface ResultatImportCarnet {
  nbNouveauxMatchs: number;
  nbMatchsCompletes: number;
  nbNouveauxParis: number;
  alertesCotes: AlerteCote[];
}

/**
 * Import depuis le carnet, additif : les matchs et paris qu'il connaît déjà ne sont jamais
 * modifiés ni supprimés — seuls les nouveaux sont ajoutés (l'application est désormais le
 * carnet de paris de l'utilisateur). Copie de sécurité avant, écriture vérifiée avec retour
 * arrière automatique au moindre écart (comme pour les matchs de l'onglet « Matchs »).
 */
export async function importerCarnet(apercu: ApercuImportCarnet): Promise<ResultatImportCarnet> {
  const { analyse, matchs, paris } = apercu;
  if (matchs.aEcrire.length || paris.nouveaux.length) await creerVersion("avant-import");
  const alertesCotes = matchs.aEcrire.length ? await ecrireMatchsVerifies(matchs.aEcrire) : [];
  if (paris.nouveaux.length) await ecrireParisVerifies(paris.nouveaux);
  for (const r of analyse.contenu.reglages) {
    if (!CLES_REGLAGES_CARNET.includes(r.cle)) continue;
    // La bankroll choisie dans l'application (l'app est désormais le carnet) n'est jamais remplacée.
    if (r.cle === "bankroll" && apercu.bankrollGardee) continue;
    await ecrireReglage(r.cle, r.valeur);
  }
  await demanderStockagePersistant();
  return { nbNouveauxMatchs: matchs.nouveaux.length, nbMatchsCompletes: matchs.misAJour.length, nbNouveauxParis: paris.nouveaux.length, alertesCotes };
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

/* ---------- Journal des paris (phase 6) ---------- */

/**
 * Écrit des paris après une copie de sécurité, relit la base et vérifie chaque pari.
 * Au moindre écart, les paris d'avant sont remis en place (même garde-fou que pour les matchs).
 */
async function ecrireParisVerifies(aEcrire: readonly Pari[]): Promise<void> {
  const ids = aEcrire.map((p) => p.id);
  const avant = await lireParis(ids);
  await ecrireParis(aEcrire);
  const relus = await lireParis(ids);
  const ok = relus.every((p, i) => p && jsonCanonique(p) === jsonCanonique(aEcrire[i]));
  if (!ok) {
    await ecrireParis(
      avant.filter((p): p is Pari => !!p),
      ids.filter((_, i) => !avant[i]),
    );
    throw new ErreurImport("Les paris ne se sont pas écrits correctement : l'état précédent a été remis en place.");
  }
}

async function lirePari(id: string): Promise<Pari> {
  const [p] = await lireParis([id]);
  if (!p) throw new ErreurImport("Ce pari n'existe plus.");
  return p;
}

export interface SaisiePari {
  date: string;
  match: string;
  methode: Pari["methode"];
  cote: number;
  mise: number;
  statut: Pari["statut"];
  pnl?: number;
  notes?: string;
  ligue?: string | null;
  matchId?: string | null;
}

/** Ajoute un pari au journal (copie de sécurité avant, écriture vérifiée). */
export async function ajouterPari(s: SaisiePari): Promise<Pari> {
  const existants = (await lireContenu()).paris;
  const maintenant = new Date().toISOString();
  const p: Pari = {
    id: nouvelId(),
    ordre: existants.reduce((max, x) => Math.max(max, x.ordre), -1) + 1,
    creeLe: maintenant,
    modifieLe: maintenant,
    ...s,
  };
  await creerVersion("avant-modification");
  await ecrireParisVerifies([p]);
  return p;
}

/** Modifie un pari existant (venu du carnet ou ajouté dans l'app : les deux se modifient pareil). */
export async function modifierPari(id: string, s: SaisiePari): Promise<Pari> {
  const avant = await lirePari(id);
  const p: Pari = { ...avant, ...s, modifieLe: new Date().toISOString() };
  await creerVersion("avant-modification");
  await ecrireParisVerifies([p]);
  return p;
}

/** Supprime un pari du journal (et sa photo de ticket, le cas échéant). */
export async function supprimerPari(id: string): Promise<void> {
  await creerVersion("avant-modification");
  await ecrireParis([], [id]);
  await supprimerPhotoTicket(id);
}

/**
 * Photo du ticket : redimensionnée avant l'appel (voir `ui/photo.ts`). Gardée hors du « contenu »
 * (ni sauvegarde fichier, ni historique des versions : elle resterait trop grosse dans les deux cas).
 */
export async function enregistrerPhotoTicket(pariId: string, blob: Blob): Promise<void> {
  await ecrirePhotoTicket({ pariId, blob, type: blob.type, ajouteLe: new Date().toISOString() });
}

export async function lirePhotoDuTicket(pariId: string): Promise<PhotoTicket | undefined> {
  return lirePhotoTicket(pariId);
}

export async function retirerPhotoTicket(pariId: string): Promise<void> {
  await supprimerPhotoTicket(pariId);
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
