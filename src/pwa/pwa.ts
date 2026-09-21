/**
 * Côté page : enregistrement du service worker, mises à jour, installation
 * sur l'écran d'accueil (Android) et notifications locales.
 *
 * Notifications : sur Android, Chrome n'accepte que les notifications affichées
 * par le service worker (`registration.showNotification`). Sans serveur, aucune
 * notification ne peut partir quand l'application est complètement fermée.
 */

export type EtatHorsLigne = "indisponible" | "installation" | "pret" | "erreur";

export interface EtatPwa {
  horsLigne: EtatHorsLigne;
  miseAJourPrete: boolean;
  installable: boolean;
  installee: boolean;
}

type Ecouteur = (e: EtatPwa) => void;

let etat: EtatPwa = {
  horsLigne: "indisponible",
  miseAJourPrete: false,
  installable: false,
  installee: typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches,
};
const ecouteurs = new Set<Ecouteur>();
let invite: (Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
let rechargerApresMiseAJour = false;

function changer(p: Partial<EtatPwa>) {
  etat = { ...etat, ...p };
  ecouteurs.forEach((f) => f(etat));
}

export function ecouterPwa(f: Ecouteur): () => void {
  ecouteurs.add(f);
  f(etat);
  return () => ecouteurs.delete(f);
}

/** Vrai dans la variante « aperçu » (artefact Claude) : pas de service worker, pas d'installation. */
export const EST_APERCU: boolean = typeof __APERCU__ === "boolean" && __APERCU__;

export function demarrerPwa(): void {
  if (EST_APERCU) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    invite = e as typeof invite;
    changer({ installable: true });
  });
  window.addEventListener("appinstalled", () => {
    invite = null;
    changer({ installable: false, installee: true });
  });

  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (rechargerApresMiseAJour) window.location.reload();
  });
  changer({ horsLigne: "installation" });
  navigator.serviceWorker
    .register("./sw.js")
    .then(async (reg) => {
      const surveiller = (w: ServiceWorker | null) => {
        if (!w) return;
        w.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) changer({ miseAJourPrete: true });
          if (w.state === "activated") changer({ horsLigne: "pret" });
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) changer({ miseAJourPrete: true });
      surveiller(reg.installing);
      reg.addEventListener("updatefound", () => surveiller(reg.installing));
      await navigator.serviceWorker.ready;
      changer({ horsLigne: "pret" });
      // Vérifie les mises à jour quand l'app revient au premier plan.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    })
    .catch(() => changer({ horsLigne: "erreur" }));
}

/** Active la nouvelle version en attente puis recharge la page. */
export async function appliquerMiseAJour(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg?.waiting) return;
  rechargerApresMiseAJour = true;
  reg.waiting.postMessage("activer-nouvelle-version");
}

/** Ouvre la fenêtre d'installation d'Android ; renvoie vrai si l'utilisateur accepte. */
export async function installer(): Promise<boolean> {
  if (!invite) return false;
  await invite.prompt();
  const choix = await invite.userChoice;
  invite = null;
  changer({ installable: false });
  return choix.outcome === "accepted";
}

export type EtatNotifications = "non-supportees" | "a-demander" | "autorisees" | "refusees";

export function etatNotifications(): EtatNotifications {
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "non-supportees";
  return Notification.permission === "granted" ? "autorisees" : Notification.permission === "denied" ? "refusees" : "a-demander";
}

export async function demanderNotifications(): Promise<EtatNotifications> {
  if (etatNotifications() === "non-supportees") return "non-supportees";
  await Notification.requestPermission();
  return etatNotifications();
}

/**
 * Affiche une notification locale via le service worker.
 * `url` : écran à ouvrir quand on touche la notification (ex. "#/donnees").
 */
export async function notifier(titre: string, corps: string, url = "./"): Promise<"envoyee" | "refusee" | "indisponible"> {
  const e = etatNotifications();
  if (e === "non-supportees") return "indisponible";
  if (e !== "autorisees") return "refusee";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "indisponible";
  await reg.showNotification(titre, {
    body: corps,
    icon: "./icons/icon-192.png",
    badge: "./icons/badge-96.png",
    lang: "fr",
    tag: "carnet-" + titre,
    data: { url },
  });
  return "envoyee";
}
