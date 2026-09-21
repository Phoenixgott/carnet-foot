/**
 * Service worker : rend l'application utilisable hors ligne et affiche les notifications.
 *
 * - À l'installation, tous les fichiers de l'app sont mis en cache (liste injectée à la construction).
 * - Ensuite, tout est servi depuis le cache : l'app démarre sans réseau.
 * - Une nouvelle version s'installe en arrière-plan et attend que l'utilisateur
 *   choisisse « Mettre à jour » (message « activer-nouvelle-version »).
 * - Aucune requête vers un autre site n'est interceptée ni faite.
 * - Le cache de la version précédente est gardé : une page encore ouverte avec elle
 *   (ou servie par l'ancien service worker juste avant la bascule) peut toujours charger
 *   ses fichiers, qui n'existent plus sur le serveur. Sans cela, l'écran restait blanc.
 */
declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE__: string[];
declare const __CACHE_VERSION__: string;

const PREFIXE = "carnet-foot-";
const CACHE = PREFIXE + __CACHE_VERSION__;
/** Entrée technique de chaque cache : date d'installation, pour savoir lequel est le précédent. */
const INSTALLE_LE = "./__installe-le";

/** Scripts et styles de l'app (noms hachés) : la page mise en cache doit les appeler. */
const FICHIERS_APP = __PRECACHE__.filter((u) => /^\.\/assets\/app-[^/]+\.(js|css)$/.test(u)).map((u) => u.slice(2));

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      // `cache: "reload"` : on ne reprend pas une copie gardée par le navigateur (GitHub Pages
      // autorise 10 minutes) ; sinon la page d'une version et les scripts d'une autre se mélangent.
      const reponses = await Promise.all(
        __PRECACHE__.map(async (u) => {
          const r = await fetch(new Request(u, { cache: "reload" }));
          if (!r.ok) throw new Error(`Fichier ${u} introuvable (${r.status})`);
          return [u, r] as const;
        }),
      );
      // Pendant un déploiement, le serveur peut encore donner l'ancienne page : on vérifie qu'elle
      // appelle bien les fichiers de cette version. Sinon l'installation échoue et sera retentée.
      for (const [u, r] of reponses) {
        if (u !== "./" && u !== "./index.html") continue;
        const page = await r.clone().text();
        const absents = FICHIERS_APP.filter((f) => !page.includes(f));
        if (absents.length) throw new Error("La page reçue appartient à une autre version (" + absents.join(", ") + ")");
      }
      const cache = await caches.open(CACHE);
      await Promise.all(reponses.map(([u, r]) => cache.put(u, r)));
      await cache.put(INSTALLE_LE, new Response(String(Date.now())));
    })().catch(async (erreur) => {
      await caches.delete(CACHE);
      throw erreur;
    }),
  );
});

/**
 * Cache abîmé : sa page appelle des fichiers qu'il ne contient pas (cas des versions 0.1.0 à 0.2.0,
 * qui pouvaient mettre en cache une page périmée). L'application reste alors blanche.
 */
async function cacheAbime(cle: string): Promise<boolean> {
  const c = await caches.open(cle);
  const page = (await c.match("./index.html")) ?? (await c.match("./"));
  if (!page) return false;
  const html = await page.text();
  for (const m of html.matchAll(/assets\/app-[^"'\s]+?\.(?:js|css)/g)) if (!(await c.match("./" + m[0]))) return true;
  return false;
}

async function versionEnServiceAbimee(): Promise<boolean> {
  for (const cle of await caches.keys()) if (cle.startsWith(PREFIXE) && cle !== CACHE && (await cacheAbime(cle))) return true;
  return false;
}

// Réparation : si la version en service est abîmée, la nouvelle version prend le relais tout de suite
// (sans attendre « Mettre à jour », puisque l'écran est blanc) et recharge les fenêtres ouvertes.
self.addEventListener("install", (e) => {
  e.waitUntil(versionEnServiceAbimee().then((abimee) => (abimee ? self.skipWaiting() : undefined)));
});

self.addEventListener("activate", (e) => {
  let reparer = false;
  const activation = (async () => {
    reparer = await versionEnServiceAbimee();
    const anciens = (await caches.keys()).filter((cle) => cle.startsWith(PREFIXE) && cle !== CACHE);
    const dates = await Promise.all(
      anciens.map(async (cle) => {
        const r = await (await caches.open(cle)).match(INSTALLE_LE);
        return r ? Number(await r.text()) || 0 : 0;
      }),
    );
    const precedent = anciens.length ? anciens[dates.indexOf(Math.max(...dates))] : null;
    for (const cle of anciens) if (cle !== precedent) await caches.delete(cle);
    await self.clients.claim();
  })();
  e.waitUntil(activation);
  // Rechargement APRÈS l'activation : pendant l'activation, la page rechargée attendrait ce
  // service worker, qui l'attendrait lui-même (blocage).
  activation.then(async () => {
    if (!reparer) return;
    for (const f of await self.clients.matchAll({ type: "window" })) await (f as WindowClient).navigate(f.url).catch(() => null);
  });
});

self.addEventListener("message", (e) => {
  if (e.data === "activer-nouvelle-version") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // Navigation : toujours l'app elle-même (le routage se fait dans la page).
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match("./index.html")) ?? (await cache.match("./")) ?? fetch(req);
      })(),
    );
    return;
  }
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // D'abord la version actuelle, puis la précédente (fichiers d'une page ouverte avant la bascule).
      return (await cache.match(req, { ignoreSearch: true })) ?? (await caches.match(req, { ignoreSearch: true })) ?? fetch(req);
    })(),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const cible = new URL((e.notification.data && e.notification.data.url) || "./", self.location.href).href;
  e.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const f of fenetres) {
        if ("focus" in f) {
          await f.focus();
          if (e.notification.data && e.notification.data.url && "navigate" in f) await f.navigate(cible);
          return;
        }
      }
      await self.clients.openWindow(cible);
    })(),
  );
});

export {};
