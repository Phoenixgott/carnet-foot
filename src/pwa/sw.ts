/**
 * Service worker : rend l'application utilisable hors ligne et affiche les notifications.
 *
 * - À l'installation, tous les fichiers de l'app sont mis en cache (liste injectée à la construction).
 * - Ensuite, tout est servi depuis le cache : l'app démarre sans réseau.
 * - Une nouvelle version s'installe en arrière-plan et attend que l'utilisateur
 *   choisisse « Mettre à jour » (message « activer-nouvelle-version »).
 * - Aucune requête vers un autre site n'est interceptée ni faite.
 */
declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE__: string[];
declare const __CACHE_VERSION__: string;

const PREFIXE = "carnet-foot-";
const CACHE = PREFIXE + __CACHE_VERSION__;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(__PRECACHE__)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const cle of await caches.keys()) if (cle.startsWith(PREFIXE) && cle !== CACHE) await caches.delete(cle);
      await self.clients.claim();
    })(),
  );
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
      return (await cache.match(req, { ignoreSearch: true })) ?? fetch(req);
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
