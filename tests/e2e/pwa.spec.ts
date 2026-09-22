/**
 * Application installable et hors ligne, thème, notifications locales.
 */
import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "playwright/test";
import { donneesCarnet } from "./outils";

const SW = fileURLToPath(new URL("../../dist/sw.js", import.meta.url));
const DIST = fileURLToPath(new URL("../../dist/", import.meta.url));

test("Manifeste complet et icônes présentes (installable sur Android)", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.getAttribute('link[rel="manifest"]', "href");
  const m = await (await request.get(new URL(href!, "http://localhost:4173/").href)).json();
  expect(m.name).toBe("Carnet de Paris Foot");
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("./");
  for (const taille of ["192x192", "512x512"]) expect(m.icons.some((i: { sizes: string }) => i.sizes === taille)).toBe(true);
  expect(m.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  for (const i of m.icons) expect((await request.get(new URL(i.src, "http://localhost:4173/").href)).ok()).toBe(true);
});

test("Hors ligne : l'application redémarre sans réseau, données comprises", async ({ context, page }) => {
  const d = donneesCarnet(12, 7, 0);
  await page.goto("/#/donnees");
  await page.fill("#texte-carnet", JSON.stringify({ paris: d.paris, reglages: d.reglages }));
  await page.locator('[data-test="importer-carnet"]').click();
  await expect(page.locator('[data-test="resultat-import"]')).toContainText("Import réussi");
  const bankroll = await page.locator('[data-test="bankroll-entete"]').textContent();
  await page.goto("/#/reglages");
  await expect(page.locator('[data-test="etat-hors-ligne"]')).toHaveText("Prête", { timeout: 15_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
  await expect(page.locator('[data-test="bankroll-entete"]')).toHaveText(bankroll!);
  await page.goto("/#/paris");
  await expect(page.locator(".pari")).toHaveCount(7);
  await context.setOffline(false);
});

test("Aucune requête vers un autre site", async ({ page }) => {
  const externes: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://localhost:4173/") && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) externes.push(r.url());
  });
  for (const ecran of ["accueil", "matchs", "paris", "donnees", "reglages"]) {
    await page.goto(`/#/${ecran}`);
    await page.waitForLoadState("networkidle");
  }
  expect(externes).toEqual([]);
});

test("Thème sombre : appliqué, gardé après rechargement, retour à l'automatique", async ({ page }) => {
  await page.goto("/#/reglages");
  await page.getByRole("button", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(10, 14, 24)");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Clair" }).click();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(238, 241, 248)");
  await page.getByRole("button", { name: "Automatique" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("Thème automatique : suit le mode sombre du téléphone", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:4173/");
  await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await p.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(10, 14, 24)");
  await ctx.close();
});

test("Notifications : activation puis notification de test via le service worker", async ({ context, page }) => {
  await context.grantPermissions(["notifications"], { origin: "http://localhost:4173" });
  await page.goto("/#/reglages");
  await expect(page.locator('[data-test="etat-hors-ligne"]')).toHaveText("Prête", { timeout: 15_000 });
  await expect(page.locator('[data-test="etat-notifs"]')).toHaveText("Activées.");
  await page.getByRole("button", { name: "Envoyer une notification de test" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Notification envoyée");
  const affichees = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.body));
  expect(affichees).toContain("Les notifications fonctionnent.");
});

test("Mise à jour : les fichiers de la version précédente restent disponibles après la bascule (pas d'écran blanc)", async ({ page }) => {
  await page.goto("/#/reglages");
  await expect(page.locator('[data-test="etat-hors-ligne"]')).toHaveText("Prête", { timeout: 15_000 });
  // Simule une nouvelle version : le script de l'app change de nom, l'ancien disparaît du serveur.
  const ancien = readdirSync(DIST + "assets").find((f) => /^app-.*\.js$/.test(f))!;
  const nouveau = "app-NOUVEAU0.js";
  const html = readFileSync(DIST + "index.html", "utf8");
  const sw = readFileSync(SW, "utf8");
  try {
    renameSync(DIST + "assets/" + ancien, DIST + "assets/" + nouveau);
    writeFileSync(DIST + "index.html", html.replace(ancien, nouveau));
    writeFileSync(SW, sw.split(ancien).join(nouveau).replace(/[0-9a-f]{12}/, "0123456789ab"));
    expect((await page.request.get("/assets/" + ancien)).status()).toBe(404);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await expect(page.getByText("Une nouvelle version de l'application est prête.")).toBeVisible({ timeout: 15_000 });
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Mettre à jour" }).click()]);
    await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
    // Le nouveau service worker contrôle la page et sert encore l'ancien script depuis le cache précédent
    const r = await page.evaluate(async (f) => {
      const rep = await fetch("./assets/" + f);
      return { statut: rep.status, caches: (await caches.keys()).filter((k) => k.startsWith("carnet-foot-")).length };
    }, ancien);
    expect(r).toEqual({ statut: 200, caches: 2 });
  } finally {
    renameSync(DIST + "assets/" + nouveau, DIST + "assets/" + ancien);
    writeFileSync(DIST + "index.html", html);
    writeFileSync(SW, sw);
  }
});

/** Prépare une « nouvelle version » dans dist/ : script copié sous un autre nom, sw.js modifié. */
function nouvelleVersion(avecPage: boolean) {
  const ancien = readdirSync(DIST + "assets").find((f) => /^app-.*\.js$/.test(f))!;
  const nouveau = "app-NOUVEAU1.js";
  const html = readFileSync(DIST + "index.html", "utf8");
  const sw = readFileSync(SW, "utf8");
  writeFileSync(DIST + "assets/" + nouveau, readFileSync(DIST + "assets/" + ancien));
  writeFileSync(SW, sw.split(ancien).join(nouveau).replace(/[0-9a-f]{12}/, "fedcba987654"));
  const publierPage = () => writeFileSync(DIST + "index.html", html.replace(ancien, nouveau));
  if (avecPage) publierPage();
  return {
    ancien,
    publierPage,
    annuler: () => {
      writeFileSync(DIST + "index.html", html);
      writeFileSync(SW, sw);
      rmSync(DIST + "assets/" + nouveau, { force: true });
    },
  };
}

test("Déploiement pas encore complet (ancienne page servie) : la nouvelle version attend au lieu de s'installer de travers", async ({ page }) => {
  await page.goto("/#/reglages");
  await expect(page.locator('[data-test="etat-hors-ligne"]')).toHaveText("Prête", { timeout: 15_000 });
  const v = nouvelleVersion(false);
  try {
    const etat = await page.evaluate(async () => {
      const reg = (await navigator.serviceWorker.getRegistration())!;
      await reg.update().catch(() => null);
      await new Promise((r) => setTimeout(r, 1500));
      return { attente: !!reg.waiting, caches: (await caches.keys()).length };
    });
    expect(etat).toEqual({ attente: false, caches: 1 });
    await expect(page.getByText("Une nouvelle version de l'application est prête.")).toHaveCount(0);
    // La page arrive enfin : la nouvelle version s'installe normalement
    v.publierPage();
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await expect(page.getByText("Une nouvelle version de l'application est prête.")).toBeVisible({ timeout: 15_000 });
  } finally {
    v.annuler();
  }
});

test("Réparation : si la version en service a un cache abîmé, la nouvelle prend le relais et recharge la page", async ({ page }) => {
  await page.goto("/#/reglages");
  await expect(page.locator('[data-test="etat-hors-ligne"]')).toHaveText("Prête", { timeout: 15_000 });
  // Abîme le cache en service comme le faisaient les versions 0.1.0 à 0.2.0 : la page appelle un script absent
  await page.evaluate(async () => {
    const c = await caches.open((await caches.keys())[0]);
    for (const r of await c.keys()) if (/\/assets\/app-.*\.js$/.test(r.url)) await c.delete(r);
  });
  const v = nouvelleVersion(true);
  try {
    await Promise.all([
      page.waitForEvent("load", { timeout: 15_000 }),
      page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update()),
    ]);
    await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
    await expect(page.getByText("Une nouvelle version de l'application est prête.")).toHaveCount(0);
    expect(await page.evaluate(() => [...document.scripts].some((s) => s.src.includes("app-NOUVEAU1.js")))).toBe(true);
  } finally {
    v.annuler();
  }
});

test("Démarrage raté (script introuvable) : la page se recharge une fois toute seule", async ({ page }) => {
  let echecs = 0;
  await page.route(/\/assets\/app-.*\.js$/, (route) => {
    if (echecs++ === 0) return route.fulfill({ status: 404, body: "" });
    return route.continue();
  });
  await page.goto("/#/accueil");
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible({ timeout: 15_000 });
  expect(echecs).toBe(2);
});

test("Mise à jour : une nouvelle version est proposée puis appliquée", async ({ page }) => {
  await page.goto("/#/reglages");
  await expect(page.locator('[data-test="etat-hors-ligne"]')).toHaveText("Prête", { timeout: 15_000 });
  // Simule la mise en ligne d'une nouvelle version : le service worker servi change.
  const original = readFileSync(SW, "utf8");
  try {
    writeFileSync(SW, original + "\n// nouvelle version " + Date.now());
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await expect(page.getByText("Une nouvelle version de l'application est prête.")).toBeVisible({ timeout: 15_000 });
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Mettre à jour" }).click()]);
    await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
    await expect(page.getByText("Une nouvelle version de l'application est prête.")).toHaveCount(0);
  } finally {
    writeFileSync(SW, original);
  }
});
