/**
 * Dépôt de données : la base IndexedDB « carnet-paris-foot » de l'appareil.
 * Rien ne quitte l'appareil : aucune donnée n'est envoyée à un serveur.
 *
 * Magasins (version 1) :
 *  - matchs    (clé : id)
 *  - paris     (clé : id, index : ordre)
 *  - reglages  (clé : cle)
 *  - versions  (clé : id, index : creeLe) — copies complètes pour l'historique
 * Version 2 :
 *  - resultats (clé : id, index : groupe = division|saison) — historiques CSV de football-data.
 *    Données publiques, réimportables : hors du « contenu » (ni sauvegarde fichier, ni versions).
 */
import type { Match, Pari, Reglage, Resultat } from "../core/types";
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
  // v1 → v2 : historiques de résultats (phase 2)
  (db) => {
    db.createObjectStore("resultats", { keyPath: "id" }).createIndex("groupe", ["division", "saison"]);
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

/**
 * Écrit (ajoute ou remplace) des matchs et en supprime d'autres, en une seule transaction.
 * Les paris et réglages ne sont pas touchés.
 */
export async function ecrireMatchs(aEcrire: readonly Match[], aSupprimer: readonly string[] = []): Promise<void> {
  const db = await ouvrirBase();
  await transaction(db, ["matchs"], "readwrite", async (tx) => {
    const s = tx.objectStore("matchs");
    await Promise.all([...aEcrire.map((m) => requete(s.put(m))), ...aSupprimer.map((id) => requete(s.delete(id)))]);
  });
}

/** Matchs lus par identifiant (undefined pour un identifiant absent). */
export async function lireMatchs(ids: readonly string[]): Promise<Array<Match | undefined>> {
  const db = await ouvrirBase();
  return transaction(db, ["matchs"], "readonly", (tx) =>
    Promise.all(ids.map((id) => requete(tx.objectStore("matchs").get(id) as IDBRequest<Match | undefined>))),
  );
}

/* ---------- Historiques de résultats (CSV) ---------- */

export async function lireResultats(): Promise<Resultat[]> {
  const db = await ouvrirBase();
  return transaction(db, ["resultats"], "readonly", (tx) => requete(tx.objectStore("resultats").getAll() as IDBRequest<Resultat[]>));
}

export async function ecrireResultats(rs: readonly Resultat[]): Promise<void> {
  const db = await ouvrirBase();
  await transaction(db, ["resultats"], "readwrite", async (tx) => {
    const s = tx.objectStore("resultats");
    await Promise.all(rs.map((r) => requete(s.put(r))));
  });
}

/** Supprime tous les résultats d'un championnat pour une saison ; renvoie le nombre supprimé. */
export async function supprimerGroupeResultats(division: string, saison: string): Promise<number> {
  const db = await ouvrirBase();
  return transaction(db, ["resultats"], "readwrite", async (tx) => {
    const s = tx.objectStore("resultats");
    const cles = await requete(s.index("groupe").getAllKeys([division, saison]));
    await Promise.all(cles.map((k) => requete(s.delete(k))));
    return cles.length;
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
