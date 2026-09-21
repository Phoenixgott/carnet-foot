/**
 * Opérations complètes sur les données, avec leurs garde-fous :
 * copie de sécurité avant toute écriture, vérification après relecture,
 * retour automatique à l'état précédent si quelque chose ne correspond pas.
 */
import { estVide, resumer, type Contenu } from "./contenu";
import {
  ajouterVersion,
  ecrireReglage,
  lireContenu,
  lireReglage,
  lireVersion,
  listerVersions,
  remplacerContenu,
  supprimerVersions,
} from "./depot";
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
  await remplacerContenu(analyse.contenu);
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
