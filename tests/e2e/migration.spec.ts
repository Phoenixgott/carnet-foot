/**
 * Migration de bout en bout : le VRAI carnet d'origine exporte ses données,
 * la nouvelle application les importe, et les chiffres affichés des deux côtés
 * doivent être identiques (bankroll, gains par méthode, chances de chaque match).
 * L'import est additif (l'application est désormais le carnet de paris de l'utilisateur) :
 * un réimport n'efface et ne remplace jamais ce qui est déjà dans l'app.
 */
import { expect, test } from "playwright/test";
import { donneesCarnet, exporterDepuisCarnet, importerDansApp, ouvrirCarnet } from "./outils";

test("Migration complète : mêmes chiffres dans le carnet et dans l'application", async ({ context, page }) => {
  const d = donneesCarnet(17, 30, 6);
  const carnet = await ouvrirCarnet(context, d);

  // Chiffres affichés par le carnet
  const bankrollCarnet = (await carnet.textContent("#hdrBank"))!.trim();
  const texte = await exporterDepuisCarnet(carnet);
  const statsCarnet = await carnet.$$eval("#stats .stat", (els) =>
    els.map((e) => ({ libelle: e.querySelector("small")!.textContent!.trim(), valeur: e.querySelector("b")!.textContent!.trim() })),
  );
  await carnet.click('nav.tabs button[data-tab="home"]');
  const chancesCarnet = await carnet.$$eval("#board article.tk", (cartes) =>
    cartes.map((c) => {
      const [dom, ext] = [...c.querySelectorAll(".team b")].map((b) => b.textContent!.trim());
      const [p1, p3] = [...c.querySelectorAll(".bet-big")].map((b) => (b.textContent!.match(/^\d+/) ?? [null])[0]);
      return { cle: `${dom}|${ext}`, p1, p3 };
    }),
  );
  expect(chancesCarnet.length).toBe(6);
  // Garde-fous : la comparaison doit porter sur de vrais chiffres, pas seulement sur des « ? »
  expect(chancesCarnet.filter((c) => c.p1 !== null && c.p3 !== null).length).toBeGreaterThanOrEqual(3);
  expect(statsCarnet.filter((s) => /^Méthode (\+1,5|\+2,5|Freebet)/.test(s.libelle)).length).toBeGreaterThanOrEqual(3);

  // Import dans l'application : tout est nouveau (premier import)
  await importerDansApp(page, texte);
  const resultat = page.locator('[data-test="resultat-import"]');
  await expect(resultat).toContainText("Import réussi");
  await expect(resultat).toContainText("30 nouveaux paris");
  await expect(resultat).toContainText("6 nouveaux matchs");

  // Bankroll identique
  await expect(page.locator('[data-test="bankroll-entete"]')).toHaveText(bankrollCarnet);

  // Gains par méthode identiques (libellés du carnet : « Méthode +1,5 (n) »)
  await page.goto("/#/paris");
  for (const s of statsCarnet) {
    const m = s.libelle.match(/^Méthode (\+1,5|\+2,5|Freebet) \((\d+)\)$/);
    if (!m) continue;
    const nom = m[1].replace(",", ".");
    await expect(page.locator(`[data-test="gains-${nom}"]`)).toHaveText(s.valeur);
  }
  await expect(page.locator('[data-test="bankroll-paris"]')).toHaveText(bankrollCarnet);
  await expect(page.locator(".pari")).toHaveCount(30);

  // Chances par match identiques (ligne « Carnet : » de chaque méthode, à côté du nouveau modèle)
  await page.goto("/#/matchs");
  await expect(page.locator("article.match")).toHaveCount(6);
  const chancesApp = await page.$$eval("article.match", (cartes) =>
    cartes.map((c) => {
      const noms = c.querySelector(".match-equipes")!.textContent!.split("–").map((s) => s.trim());
      const [p1, p3] = [...c.querySelectorAll(".methode")].map(
        (b) => (b.querySelector('[data-test="chances-carnet"]')!.textContent!.match(/^\d+/) ?? [null])[0],
      );
      return { cle: `${noms[0]}|${noms[1]}`, p1, p3 };
    }),
  );
  const tri = (l: Array<{ cle: string }>) => [...l].sort((a, b) => a.cle.localeCompare(b.cle));
  expect(tri(chancesApp)).toEqual(tri(chancesCarnet));

  // Les données survivent au rechargement (IndexedDB)
  await page.reload();
  await expect(page.locator('[data-test="bankroll-entete"]')).toHaveText(bankrollCarnet);
});

test("Réimport additif : n'efface ni ne remplace un pari déjà présent, même modifié dans l'app depuis", async ({ context, page }) => {
  const d1 = donneesCarnet(3, 12, 3);
  const carnet = await ouvrirCarnet(context, d1);
  const texte1 = await exporterDepuisCarnet(carnet);
  const bankroll1 = (await carnet.textContent("#hdrBank"))!.trim();
  await importerDansApp(page, texte1);
  await expect(page.locator('[data-test="bankroll-entete"]')).toHaveText(bankroll1);
  await expect(page.locator('[data-test="resultat-import"]')).toContainText("12 nouveaux paris");

  // Réimporter exactement le même export : rien de nouveau, aucun bouton « Importer »
  await page.goto("/#/donnees");
  await page.fill("#texte-carnet", texte1);
  await expect(page.locator('[data-test="import-rien-de-nouveau"]')).toBeVisible();
  await expect(page.locator('[data-test="importer-carnet"]')).toHaveCount(0);

  // Un pari est modifié dans l'app (statut et cote corrigés à la main)
  await page.goto("/#/paris");
  await page.locator(".pari").first().getByRole("button", { name: "Modifier" }).click();
  await page.selectOption("#pari-statut", "gagne");
  await page.fill("#pari-cote", "9,99");
  await page.getByRole("button", { name: "Enregistrer le pari" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Pari modifié");
  await expect(page.locator(".pari").first()).toContainText("9,99");

  // Le carnet a changé (plus de paris) : réimporter ajoute les nouveaux, sans toucher au pari modifié
  const d2 = donneesCarnet(4, 20, 2);
  await carnet.evaluate((d) => localStorage.setItem("cpf_paris", JSON.stringify(d.paris)), d2);
  await carnet.reload();
  const texte2 = await exporterDepuisCarnet(carnet);
  await importerDansApp(page, texte2);
  await expect(page.locator('[data-test="resultat-import"]')).toContainText("20 nouveaux paris");
  await page.goto("/#/paris");
  await expect(page.locator(".pari")).toHaveCount(32, { timeout: 10_000 }); // 12 + 20, aucun remplacé
  await expect(page.locator(".pari", { hasText: "9,99" })).toHaveCount(1); // le pari modifié est toujours là, intact, sans doublon

  // Une copie de sécurité existe avant la modification et avant le 2e import (le tout premier
  // import partait d'une app vide : pas de copie à faire, comme pour tout import sur une app vide).
  await page.goto("/#/donnees");
  await expect(page.locator(".versions li", { hasText: "Avant un import" })).toHaveCount(1);
  await expect(page.locator(".versions li", { hasText: "Avant une modification" })).toHaveCount(1);
});

test("Export abîmé : refusé avec un message clair, rien n'est modifié", async ({ page }) => {
  await page.goto("/#/donnees");
  await page.fill("#texte-carnet", '{"app":"carnet-paris-foot","type":"export-complet","version":1,"cles":{"paris":[{"date"');
  await expect(page.getByRole("alert")).toContainText("illisible");
  await expect(page.locator('[data-test="apercu-import"]')).toHaveCount(0);
});

test("Ancienne sauvegarde du carnet (« Copier ma sauvegarde ») : acceptée avec avertissement", async ({ page }) => {
  const d = donneesCarnet(8, 5, 0);
  await page.goto("/#/donnees");
  await page.fill("#texte-carnet", JSON.stringify({ paris: d.paris, reglages: d.reglages }));
  const apercu = page.locator('[data-test="apercu-import"]');
  await expect(apercu).toContainText("Ancienne sauvegarde");
  await expect(apercu).toContainText("ne contient que les paris");
  await page.locator('[data-test="importer-carnet"]').click();
  await expect(page.locator('[data-test="resultat-import"]')).toContainText("Import réussi");
  await page.goto("/#/paris");
  await expect(page.locator(".pari")).toHaveCount(5);
});
