/**
 * Petite surcouche d'IndexedDB : ouverture avec migrations versionnées
 * et transactions sous forme de promesses.
 *
 * Migrations : `migrations[i]` fait passer la base de la version i à i+1.
 * On n'en modifie ni n'en supprime jamais une : on en ajoute une nouvelle.
 */

export type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

export function ouvrir(nom: string, migrations: readonly Migration[]): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Ce navigateur ne permet pas d'enregistrer des données (IndexedDB indisponible)."));
      return;
    }
    const req = indexedDB.open(nom, migrations.length);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const tx = req.transaction!;
      for (let v = ev.oldVersion; v < migrations.length; v++) migrations[v](db, tx);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Si une version plus récente de l'app s'ouvre dans un autre onglet, on libère la base.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("Ouverture de la base impossible."));
    req.onblocked = () => reject(new Error("La base est bloquée par un autre onglet de l'application : ferme-le puis recharge."));
  });
}

export function requete<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * Exécute `travail` dans une transaction ; la promesse est tenue quand la transaction
 * est validée (tout ou rien : en cas d'erreur, aucune écriture n'est gardée).
 */
export function transaction<T>(
  db: IDBDatabase,
  magasins: string[],
  mode: IDBTransactionMode,
  travail: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(magasins, mode);
    let resultat: T;
    let echec: unknown = null;
    tx.oncomplete = () => (echec ? reject(echec) : resolve(resultat));
    tx.onerror = () => reject(tx.error ?? echec);
    tx.onabort = () => reject(tx.error ?? echec ?? new Error("Transaction annulée."));
    Promise.resolve()
      .then(() => travail(tx))
      .then((r) => {
        resultat = r;
      })
      .catch((e) => {
        echec = e;
        try {
          tx.abort();
        } catch {
          /* déjà terminée */
        }
      });
  });
}
