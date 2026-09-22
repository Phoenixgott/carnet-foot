/**
 * Premier démarrage simplifié : la bankroll de départ est demandée (chacun a la sienne), puis
 * trois tuiles pour commencer. La bankroll se change dans Réglages, et un import du carnet ne
 * remplace jamais celle choisie dans l'application.
 */
import { expect, test } from "playwright/test";
import { donneesCarnet, exporterDepuisCarnet, importerDansApp, ouvrirCarnet } from "./outils";

test("Premier démarrage : une seule question (la bankroll), puis trois tuiles pour commencer", async ({ page }) => {
  await page.goto("/");
  const accueil = page.locator('[data-test="bienvenue"]');
  await expect(accueil).toContainText("Combien as-tu pour parier ?");
  await expect(page.locator('[data-test="bankroll-entete"]')).toHaveCount(0);

  // Saisie refusée avec un message clair
  await page.fill("#bienvenue-bankroll", "0");
  await page.getByRole("button", { name: "C'est parti" }).click();
  await expect(page.getByRole("alert")).toContainText("supérieur à 0");

  // Montant rapide, puis montant tapé
  await page.getByRole("button", { name: "50 €" }).click();
  await expect(page.locator("#bienvenue-bankroll")).toHaveValue("50");
  await page.fill("#bienvenue-bankroll", "33");
  await page.getByRole("button", { name: "C'est parti" }).click();
  await expect(page.locator('[data-test="toast"]')).toContainText("C'est parti avec 33,00 €");

  await expect(page.locator('[data-test="bankroll"]')).toHaveText("33,00 €");
  await expect(page.locator('[data-test="bankroll-entete"]')).toHaveText("33,00 €");
  const tuiles = page.locator('[data-test="premiers-pas"]');
  await expect(tuiles.getByRole("link")).toHaveCount(3);

  await tuiles.getByRole("link", { name: /Noter un pari/ }).click();
  await expect(page).toHaveURL(/#\/paris$/);
  await expect(page.locator('[data-test="bankroll-paris"]')).toHaveText("33,00 €");

  // Gardée après rechargement
  await page.goto("/");
  await expect(page.locator('[data-test="bienvenue"]')).toHaveCount(0);
  await expect(page.locator('[data-test="bankroll"]')).toHaveText("33,00 €");
});

test("Ma bankroll dans les réglages : modifiable, la mise conseillée suit", async ({ page }) => {
  await page.goto("/");
  await page.fill("#bienvenue-bankroll", "33");
  await page.getByRole("button", { name: "C'est parti" }).click();
  await expect(page.locator('[data-test="toast"]')).toContainText("C'est parti");

  await page.goto("/#/reglages");
  await expect(page.locator("#bankroll-depart")).toHaveValue("33");
  await page.fill("#bankroll-depart", "100");
  await page.fill("#bankroll-pct", "5");
  await expect(page.locator('[data-test="bankroll-exemple"]')).toContainText("5,00 €");
  await page.getByRole("button", { name: "Enregistrer ma bankroll" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Bankroll enregistrée");

  await page.goto("/#/paris");
  await expect(page.locator('[data-test="bankroll-paris"]')).toHaveText("100,00 €");
  await expect(page.getByText(/mise conseillée 5,00 €/)).toBeVisible();

  // Valeur impossible refusée
  await page.goto("/#/reglages");
  await page.fill("#bankroll-depart", "-5");
  await page.getByRole("button", { name: "Enregistrer ma bankroll" }).click();
  await expect(page.getByRole("alert")).toContainText("supérieur à 0");
});

test("Import du carnet après le premier démarrage : la bankroll choisie dans l'app est gardée", async ({ context, page }) => {
  await page.goto("/");
  await page.fill("#bienvenue-bankroll", "33");
  await page.getByRole("button", { name: "C'est parti" }).click();
  await expect(page.locator('[data-test="toast"]')).toContainText("C'est parti");

  const carnet = await ouvrirCarnet(context, donneesCarnet(70, 5, 1));
  await page.goto("/#/donnees");
  await page.fill("#texte-carnet", await exporterDepuisCarnet(carnet));
  await expect(page.locator('[data-test="bankroll-gardee"]')).toContainText("33,00 €");
  await importerDansApp(page, await exporterDepuisCarnet(carnet));
  await page.goto("/#/paris");
  await expect(page.getByText(/Bankroll de départ 33,00 €/)).toBeVisible();
});
