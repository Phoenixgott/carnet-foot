/**
 * Dépôt de données : la base IndexedDB « carnet-paris-foot » de l'appareil.
 * Rien ne quitte l'appareil : aucune donnée n'est envoyée à un serveur.
 *
 * Magasins (version 1) :
 *  - matchs    (clé : id)
 *  - paris     (clé : id, index : ordre)
 *  - reglages  (clé : cle)
 *  - versions  (clé : id, index : creeLe) — copies complètes pour l'historique
 */
import type { Match, Pari, Reglage } from "../core/types";
import { REGLAGES_LOCAUX, type Contenu } from "./contenu";
import { ouvrir, requete, transaction, type Migration } from "./idb";
import type { Version } from "./versions";

export const NOM_BASE = "carnet-paris-foot";

export const MIGRATIONS: readonly Migration[] = [
  // v0 → v1 : création des magasins
  (db) => {
    db.createObjectStore("matchs", { keyPath: "id" });
    db.createObjectStore("paris", { keyPath: "id" }).createIndex("ordre", "ordre");
    db.createObjectStore("reglages", { keyPath: "cle" });
    db.createObjectStore("versions", { keyPath: "id" }).createIndex("creeLe", "creeLe");
  },
];

let base: Promise<IDBDatabase> | null = null;

export function ouvrirBase(): Promise<IDBDatabase> {
  if (!base) {
    base = ouvrir(NOM_BASE, MIGRATIONS).catch((e) => {
      base = null;
      throw e;
    });
  }
  return base;
}

export async function lireContenu(): Promise<Contenu> {
  const db = await ouvrirBase();
  return transaction(db, ["matchs", "paris", "reglages"], "readonly", async (tx) => {
    const [matchs, paris, reglages] = await Promise.all([
      requete(tx.objectStore("matchs").getAll() as IDBRequest<Match[]>),
      requete(tx.objectStore("paris").index("ordre").getAll() as IDBRequest<Pari[]>),
      requete(tx.objectStore("reglages").getAll() as IDBRequest<Reglage[]>),
    ]);
    return { matchs, paris, reglages };
  });
}

/**
 * Remplace tout le contenu en une seule transaction (tout ou rien).
 * Les réglages propres à l'appareil (ex. date du dernier export) sont conservés.
 */
export async function remplacerContenu(c: Contenu): Promise<void> {
  const db = await ouvrirBase();
  await transaction(db, ["matchs", "paris", "reglages"], "readwrite", async (tx) => {
    const sm = tx.objectStore("matchs");
    const sp = tx.objectStore("paris");
    const sr = tx.objectStore("reglages");
    const locaux = (await requete(sr.getAll() as IDBRequest<Reglage[]>)).filter((r) => REGLAGES_LOCAUX.includes(r.cle));
    await Promise.all([requete(sm.clear()), requete(sp.clear()), requete(sr.clear())]);
    const ecritures: Array<Promise<unknown>> = [];
    for (const m of c.matchs) ecritures.push(requete(sm.put(m)));
    for (const p of c.paris) ecritures.push(requete(sp.put(p)));
    for (const r of c.reglages) if (!REGLAGES_LOCAUX.includes(r.cle)) ecritures.push(requete(sr.put(r)));
    for (const r of locaux) ecritures.push(requete(sr.put(r)));
    await Promise.all(ecritures);
  });
}

export async function lireReglage<T>(cle: string): Promise<T | undefined> {
  const db = await ouvrirBase();
  const r = await transaction(db, ["reglages"], "readonly", (tx) =>
    requete(tx.objectStore("reglages").get(cle) as IDBRequest<Reglage<T> | undefined>),
  );
  return r?.valeur;
}

export async function ecrireReglage<T>(cle: string, valeur: T): Promise<void> {
  const db = await ouvrirBase();
  await transaction(db, ["reglages"], "readwrite", (tx) => requete(tx.objectStore("reglages").put({ cle, valeur })));
}

export async function ajouterVersion(v: Version): Promise<void> {
  const db = await ouvrirBase();
  await transaction(db, ["versions"], "readwrite", (tx) => requete(tx.objectStore("versions").put(v)));
}

/** Toutes les versions, de la plus récente à la plus ancienne. */
export async function listerVersions(): Promise<Version[]> {
  const db = await ouvrirBase();
  const toutes = await transaction(db, ["versions"], "readonly", (tx) =>
    requete(tx.objectStore("versions").index("creeLe").getAll() as IDBRequest<Version[]>),
  );
  return toutes.reverse();
}

export async function lireVersion(id: string): Promise<Version | undefined> {
  const db = await ouvrirBase();
  return transaction(db, ["versions"], "readonly", (tx) => requete(tx.objectStore("versions").get(id) as IDBRequest<Version | undefined>));
}

export async function supprimerVersions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await ouvrirBase();
  await transaction(db, ["versions"], "readwrite", async (tx) => {
    await Promise.all(ids.map((id) => requete(tx.objectStore("versions").delete(id))));
  });
}
