/**
 * Accessibilité et confort sur téléphone, écran par écran, en clair et en sombre :
 * noms accessibles, étiquettes, titres, cibles tactiles, pas de défilement horizontal,
 * navigation au clavier.
 */
import { expect, test, type Page } from "playwright/test";
import { donneesCarnet, exporterDepuisCarnet, importerDansApp, ouvrirCarnet } from "./outils";

const ECRANS = ["accueil", "matchs", "live", "paris", "donnees", "reglages", "aide", "recherche"];

async function auditer(page: Page, ecran: string) {
  await page.locator("main h1").waitFor();
  const r = await page.evaluate(() => {
    // Les blocs repliables sont tous ouverts : leur contenu est audité lui aussi.
    document.querySelectorAll("details").forEach((d) => (d.open = true));
    const visible = (e: Element) => {
      const s = getComputedStyle(e);
      const b = e.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && b.width > 0 && b.height > 0;
    };
    const nom = (e: Element) =>
      (e.getAttribute("aria-label") || (e as HTMLElement).innerText || e.getAttribute("title") || "").trim();
    const problemes: string[] = [];
    for (const e of document.querySelectorAll("button, a[href]")) {
      if (!nom(e) && visible(e)) problemes.push("sans nom : " + e.outerHTML.slice(0, 80));
    }
    for (const e of document.querySelectorAll("input, textarea, select")) {
      const id = e.id;
      const etiquette = (id && document.querySelector(`label[for="${id}"]`)) || e.closest("label") || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby");
      if (!etiquette) problemes.push("champ sans étiquette : " + e.outerHTML.slice(0, 80));
    }
    for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) problemes.push("image sans alt");
    const h1 = document.querySelectorAll("main h1").length;
    if (h1 !== 1) problemes.push(`${h1} titres h1`);
    // Cibles tactiles : au moins 44 px de haut pour les boutons et les onglets
    for (const e of document.querySelectorAll("main .btn, nav.onglets a, .segments button")) {
      const h = e.getBoundingClientRect().height;
      if (visible(e) && h < 44) problemes.push(`cible trop petite (${Math.round(h)} px) : ${nom(e)}`);
    }
    const debord = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (debord > 0) problemes.push(`défilement horizontal de ${debord} px`);
    return problemes;
  });
  expect(r, `écran ${ecran}`).toEqual([]);
}

for (const largeur of [360, 412]) {
  for (const schema of ["light", "dark"] as const) {
    test(`Audit accessibilité, ${largeur} px, thème ${schema === "light" ? "clair" : "sombre"}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largeur, height: 800 }, colorScheme: schema, isMobile: true, hasTouch: true, locale: "fr-FR" });
      const carnet = await ouvrirCarnet(ctx, donneesCarnet(30, 10, 4));
      const texte = await exporterDepuisCarnet(carnet);
      const page = await ctx.newPage();
      await page.goto("http://localhost:4173/");
      await auditer(page, "accueil vide");
      await page.goto("http://localhost:4173/#/donnees");
      await page.fill("#texte-carnet", texte);
      await page.locator('[data-test="apercu-import"]').waitFor();
      await auditer(page, "données, aperçu d'import");
      await page.locator('[data-test="importer-carnet"]').click();
      await page.locator('[data-test="resultat-import"]').waitFor();
      for (const e of ECRANS) {
        await page.goto(`http://localhost:4173/#/${e}`);
        await page.getByRole("heading", { level: 1 }).waitFor();
        await auditer(page, e);
      }
      await ctx.close();
    });
  }
}

test("Clavier : lien d'évitement en premier, onglets atteignables, focus visible sur le titre", async ({ page }) => {
  await page.goto("/");
  await page.locator("main h1").waitFor();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveText("Aller au contenu");
  await page.keyboard.press("Enter");
  await expect(page.locator(":focus")).toHaveText("Accueil");
  await page.goto("/#/donnees");
  await page.getByRole("link", { name: "Réglages" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeFocused();
  await expect(page.getByRole("link", { name: "Réglages" })).toHaveAttribute("aria-current", "page");
});

test("Boîte de confirmation : Échap annule, rien n'est modifié", async ({ context, page }) => {
  const carnet = await ouvrirCarnet(context, donneesCarnet(31, 5, 1));
  await importerDansApp(page, await exporterDepuisCarnet(carnet));
  // Une 2ᵉ import additif crée une copie de sécurité (« avant-import ») : sa restauration est une
  // action destructrice protégée par une boîte de confirmation, comme le remplacement l'était avant.
  const autre = await ouvrirCarnet(context, donneesCarnet(32, 2, 0));
  await importerDansApp(page, await exporterDepuisCarnet(autre));
  const bankroll = await page.locator('[data-test="bankroll-entete"]').textContent();
  await page.getByRole("button", { name: /^Restaurer la version du/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator('[data-test="bankroll-entete"]')).toHaveText(bankroll!);
});
