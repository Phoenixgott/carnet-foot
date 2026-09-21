/**
 * Sauvegarde et restauration en un fichier, historique des versions, copie du jour.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { donneesCarnet, exporterDepuisCarnet, importerDansApp, ouvrirCarnet } from "./outils";

test("Sauvegarde fichier puis restauration : retour exact aux mêmes données", async ({ context, page }) => {
  const carnet = await ouvrirCarnet(context, donneesCarnet(21, 18, 4));
  const texte = await exporterDepuisCarnet(carnet);
  const bankroll = (await carnet.textContent("#hdrBank"))!.trim();
  await importerDansApp(page, texte);

  // Enregistrer le fichier
  await page.goto("/#/donnees");
  const [telechargement] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Enregistrer le fichier" }).click(),
  ]);
  expect(telechargement.suggestedFilename()).toMatch(/^carnet-foot-sauvegarde-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  const chemin = await telechargement.path();
  const contenu = readFileSync(chemin!, "utf8");
  const fichier = JSON.parse(contenu);
  expect(fichier.app).toBe("carnet-foot");
  expect(fichier.contenu.paris).toHaveLength(18);
  await expect(page.locator(".aide", { hasText: "Dernière sauvegarde fichier" })).toBeVisible();

  // Les données changent (autre import), puis on restaure le fichier
  const autre = await ouvrirCarnet(context, donneesCarnet(22, 3, 1));
  await importerDansApp(page, await exporterDepuisCarnet(autre), true);
  await expect(page.locator('[data-test="bankroll-entete"]')).not.toHaveText(bankroll);

  await page.goto("/#/donnees");
  await page.locator("#texte-sauvegarde").locator("xpath=..").locator('input[type="file"]').setInputFiles({
    name: "sauvegarde.json",
    mimeType: "application/json",
    buffer: Buffer.from(contenu),
  });
  await expect(page.getByText("Sauvegarde intacte")).toBeVisible();
  await page.getByRole("button", { name: "Restaurer cette sauvegarde" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Restaurer" }).click();
  await expect(page.locator('[data-test="bankroll-entete"]')).toHaveText(bankroll);
  await page.goto("/#/paris");
  await expect(page.locator(".pari")).toHaveCount(18);
});

test("Sauvegarde modifiée à la main : refusée, rien n'est restauré", async ({ context, page }) => {
  const carnet = await ouvrirCarnet(context, donneesCarnet(5, 6, 1));
  await importerDansApp(page, await exporterDepuisCarnet(carnet));
  await page.goto("/#/donnees");
  const [telechargement] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Enregistrer le fichier" }).click()]);
  const f = JSON.parse(readFileSync((await telechargement.path())!, "utf8"));
  f.contenu.paris[0].mise = 9999;
  await page.fill("#texte-sauvegarde", JSON.stringify(f));
  await expect(page.getByRole("alert")).toContainText("abîmée");
  await expect(page.getByRole("button", { name: "Restaurer cette sauvegarde" })).toHaveCount(0);
});

test("Copie du jour créée automatiquement, copie manuelle possible", async ({ context, page }) => {
  const carnet = await ouvrirCarnet(context, donneesCarnet(6, 4, 1));
  await importerDansApp(page, await exporterDepuisCarnet(carnet));
  // La copie du jour se fait au démarrage quand il y a des données
  await page.reload();
  await page.goto("/#/donnees");
  await expect(page.locator(".versions li", { hasText: "Copie du jour" })).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".versions li", { hasText: "Copie du jour" })).toHaveCount(1);
  await page.getByRole("button", { name: "Créer une copie maintenant" }).click();
  await expect(page.locator(".versions li", { hasText: "Copie manuelle" })).toHaveCount(1);
});

test("Rappel de sauvegarde sur l'accueil tant qu'aucun fichier n'a été enregistré", async ({ context, page }) => {
  const carnet = await ouvrirCarnet(context, donneesCarnet(7, 4, 1));
  await importerDansApp(page, await exporterDepuisCarnet(carnet));
  await page.goto("/#/accueil");
  await expect(page.getByText("jamais enregistré de sauvegarde fichier")).toBeVisible();
  await page.goto("/#/donnees");
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Enregistrer le fichier" }).click()]);
  await expect(page.locator(".aide", { hasText: "Dernière sauvegarde fichier" })).toBeVisible();
  await page.goto("/#/accueil");
  await expect(page.getByText("jamais enregistré de sauvegarde fichier")).toHaveCount(0);
});
