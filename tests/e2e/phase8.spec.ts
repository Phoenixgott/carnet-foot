/**
 * Phase 8 de bout en bout : jeu responsable (rappels, pause/auto-exclusion), bilan hebdomadaire,
 * recherche globale, tutoriel intégré.
 */
import { expect, test, type Page } from "playwright/test";

async function ajouterPari(page: Page, p: { match: string; date?: string; methode?: string; cote: string; mise: string; statut?: string }) {
  await page.getByRole("button", { name: "Ajouter un pari" }).click();
  await page.fill("#pari-match", p.match);
  if (p.date) await page.fill("#pari-date", p.date);
  if (p.methode) await page.selectOption("#pari-methode", p.methode);
  await page.fill("#pari-cote", p.cote);
  await page.fill("#pari-mise", p.mise);
  if (p.statut) await page.selectOption("#pari-statut", p.statut);
  await page.getByRole("button", { name: "Ajouter le pari" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Pari ajouté");
}

test("Rappel de pause : après des défaites d'affilée, bandeau sur l'accueil, pause en un clic, ajout bloqué", async ({ page }) => {
  await page.goto("/#/reglages");
  await page.fill("#jr-defaites", "2");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Réglages de jeu responsable enregistrés");

  await page.goto("/#/paris");
  await ajouterPari(page, { match: "A – B", cote: "2,00", mise: "10", statut: "gagne" });
  await ajouterPari(page, { match: "C – D", cote: "2,00", mise: "10", statut: "perdu" });
  await expect(page.locator('[data-test="rappel-jeu-responsable"]')).toHaveCount(0); // une seule défaite : pas encore de rappel
  await ajouterPari(page, { match: "E – F", cote: "2,00", mise: "10", statut: "perdu" });

  await page.goto("/#/accueil");
  const rappel = page.locator('[data-test="rappel-jeu-responsable"]');
  await expect(rappel).toContainText("2 défaites d'affilée");
  await rappel.getByRole("button", { name: /Faire une pause/ }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Pause commencée");
  await expect(page.locator('[data-test="pause-accueil"]')).toBeVisible();
  await expect(rappel).toHaveCount(0); // le rappel disparaît une fois la pause commencée

  // L'ajout d'un nouveau pari est bloqué, mais pas la modification d'un pari existant.
  await page.goto("/#/paris");
  await page.getByRole("button", { name: "Ajouter un pari" }).click();
  await expect(page.locator('[data-test="pause-active"]')).toContainText("Pause en cours");
  await expect(page.locator("#pari-match")).toHaveCount(0);
  await page.getByRole("button", { name: "Modifier le pari A – B" }).click();
  await expect(page.locator("#pari-match")).toHaveValue("A – B");
  await page.getByRole("button", { name: "Annuler" }).click();

  // Échap annule l'arrêt de la pause : rien ne change.
  await page.goto("/#/reglages");
  await expect(page.locator('[data-test="reglages-jeu-responsable"]')).toContainText("Pause en cours");
  await page.getByRole("button", { name: "Arrêter la pause" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-test="reglages-jeu-responsable"]')).toContainText("Pause en cours");

  // Confirmée cette fois : la pause s'arrête, l'ajout redevient possible.
  await page.getByRole("button", { name: "Arrêter la pause" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Arrêter la pause" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Pause arrêtée");
  await page.goto("/#/paris");
  await page.getByRole("button", { name: "Ajouter un pari" }).click();
  await expect(page.locator("#pari-match")).toBeVisible();
});

test("Pause posée directement dans les réglages, avec une durée choisie", async ({ page }) => {
  await page.goto("/#/reglages");
  await page.fill("#pause-perso", "5");
  await page.getByRole("button", { name: "Commencer" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Pause commencée");
  await expect(page.locator('[data-test="pause-reglages"]')).toContainText("Pause posée dans les réglages");
});

test("Bilan hebdomadaire : chiffres de la semaine en cours affichés sur l'accueil", async ({ page }) => {
  const lundi = "2026-09-21";
  await page.goto("/#/paris");
  await ajouterPari(page, { match: "A – B", date: lundi, methode: "+1.5", cote: "1,50", mise: "10", statut: "gagne" }); // +5
  await ajouterPari(page, { match: "C – D", date: "2026-09-23", methode: "+2.5", cote: "2,00", mise: "10", statut: "perdu" }); // -10

  await page.goto("/#/accueil");
  const carte = page.locator('[data-test="bilan-semaine"]');
  await expect(carte).toContainText("−5,00 €"); // 5 - 10
  await expect(carte).toContainText("sur 2 paris terminés (1 gagné)");
});

test("Recherche : retrouve un match et un pari par un mot", async ({ page }) => {
  await page.goto("/#/matchs");
  const rec = page.locator('[data-test="recuperer"]');
  if ((await rec.getAttribute("open")) === null) await rec.locator("> summary").click();
  const m = { id: "2030-05-04-lens-brest", date: "2030-05-04", domicile: { nom: "Lens" }, exterieur: { nom: "Brest" } };
  await page.fill("#reponse-claude", "```json\n" + JSON.stringify({ matchs: [m] }) + "\n```");
  await page.getByRole("button", { name: /^Enregistrer/ }).first().click();
  await page.locator('[data-test="resultat-matchs"]').waitFor();

  await page.goto("/#/paris");
  await ajouterPari(page, { match: "Un pari notable", cote: "2,00", mise: "10" });

  await page.goto("/#/recherche");
  await page.fill("#recherche-mot", "brest");
  await expect(page.locator('[data-test="resultats-recherche"]')).toContainText("Lens – Brest");

  await page.fill("#recherche-mot", "notable");
  await expect(page.locator('[data-test="resultats-recherche"]')).toContainText("Un pari notable");

  await page.fill("#recherche-mot", "azertyintrouvable");
  await expect(page.locator('[data-test="recherche-nb"]')).toHaveText("Aucun résultat.");
});

test("Aide : accessible depuis les réglages, sections repliables", async ({ page }) => {
  await page.goto("/#/reglages");
  await page.getByRole("link", { name: "Comment ça marche ? (tutoriel complet)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Comment ça marche" })).toBeVisible();
  const section = page.getByText("Qu'est-ce que la méthode +1.5 ?");
  await expect(page.getByText(/Un pari en direct/)).toBeHidden();
  await section.click();
  await expect(page.getByText(/Un pari en direct/)).toBeVisible();
  await page.getByRole("link", { name: "← Retour aux réglages" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
});
