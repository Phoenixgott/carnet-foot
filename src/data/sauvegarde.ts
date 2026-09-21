/**
 * Fichier de sauvegarde complet de l'application (tout le contenu en un fichier JSON),
 * avec une empreinte SHA-256 pour détecter un fichier abîmé ou tronqué.
 * Fonctions pures (hors calcul d'empreinte, asynchrone).
 */
import { ErreurImport, extraireJson } from "./import-carnet";
import { empreinte, resumer, sansReglagesLocaux, trierContenu, type Contenu, type ResumeContenu } from "./contenu";

export const SCHEMA_SAUVEGARDE = 1;

export interface FichierSauvegarde {
  app: "carnet-foot";
  type: "sauvegarde";
  schema: number;
  creeLe: string;
  versionApp: string;
  contenu: Contenu;
  controle: ResumeContenu & { empreinte: string };
}

export async function creerSauvegarde(contenu: Contenu, versionApp: string, maintenant: Date): Promise<FichierSauvegarde> {
  const c = trierContenu(sansReglagesLocaux(contenu));
  return {
    app: "carnet-foot",
    type: "sauvegarde",
    schema: SCHEMA_SAUVEGARDE,
    creeLe: maintenant.toISOString(),
    versionApp,
    contenu: c,
    controle: { ...resumer(c), empreinte: await empreinte(c) },
  };
}

/** Nom de fichier lisible et triable : carnet-foot-sauvegarde-2026-09-21-1542.json */
export function nomFichierSauvegarde(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `carnet-foot-sauvegarde-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.json`;
}

export interface SauvegardeLue {
  contenu: Contenu;
  resume: ResumeContenu;
  creeLe: string;
  empreinte: string;
}

export async function lireSauvegarde(texte: string): Promise<SauvegardeLue> {
  const f = extraireJson(texte) as Record<string, any>;
  if (f?.app === "carnet-paris-foot") {
    throw new ErreurImport("C'est un export du carnet d'origine : utilise « Importer depuis le carnet ».");
  }
  if (f?.app !== "carnet-foot" || f.type !== "sauvegarde") {
    throw new ErreurImport("Ce fichier n'est pas une sauvegarde du Carnet de Paris Foot.");
  }
  if (typeof f.schema !== "number" || f.schema > SCHEMA_SAUVEGARDE) {
    throw new ErreurImport("Cette sauvegarde vient d'une version plus récente de l'application : mets l'application à jour avant de la restaurer.");
  }
  const c = f.contenu;
  if (!c || !Array.isArray(c.matchs) || !Array.isArray(c.paris) || !Array.isArray(c.reglages)) {
    throw new ErreurImport("Sauvegarde incomplète : il manque les matchs, les paris ou les réglages.");
  }
  const calculee = await empreinte(c);
  if (!f.controle || f.controle.empreinte !== calculee) {
    throw new ErreurImport("Sauvegarde abîmée : son contenu ne correspond plus à son empreinte. Elle a peut-être été modifiée ou coupée. Rien n'a été restauré.");
  }
  return { contenu: c, resume: resumer(c), creeLe: String(f.creeLe ?? ""), empreinte: calculee };
}
