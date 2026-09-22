/**
 * Variante « aperçu » (publiée comme artefact Claude) : servie comme le fait la publication,
 * dans un squelette HTML ajouté autour de la page. Elle doit fonctionner sans service worker
 * et sans téléchargement de fichier.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "playwright/test";
import { donneesCarnet } from "./outils";

const DOSSIER = fileURLToPath(new URL("../../dist-apercu/", import.meta.url));
const ORIGINE = "https://apercu.test/";

test.skip(!existsSync(DOSSIER + "index.html"), "Aperçu non construit (npm run build:apercu)");

test("Aperçu : l'app fonctionne dans une page d'artefact, import compris", async ({ context, page }) => {
  const corps = readFileSync(DOSSIER + "index.html", "utf8");
  const squelette = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${corps}</body></html>`;
  await context.route(ORIGINE + "**", (r) => {
    const chemin = new URL(r.request().url()).pathname.slice(1);
    if (!chemin) return r.fulfill({ contentType: "text/html; charset=utf-8", body: squelette });
    const types: Record<string, string> = { js: "text/javascript", css: "text/css", png: "image/png" };
    return r.fulfill({ contentType: types[chemin.split(".").pop()!] ?? "application/octet-stream", body: readFileSync(DOSSIER + chemin) });
  });
  await page.goto(ORIGINE);
  await expect(page).toHaveTitle("Nouveau Carnet Foot");
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();

  const d = donneesCarnet(40, 9, 0);
  await page.goto(ORIGINE + "#/donnees");
  await page.fill("#texte-carnet", JSON.stringify({ paris: d.paris, reglages: d.reglages }));
  await page.locator('[data-test="importer-carnet"]').click();
  await expect(page.locator('[data-test="resultat-import"]')).toContainText("Import réussi");
  await expect(page.getByRole("button", { name: "Enregistrer le fichier" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copier le texte" })).toBeVisible();

  await page.goto(ORIGINE + "#/reglages");
  await expect(page.locator('[data-test="etat-hors-ligne"]')).toHaveText("Indisponible ici");
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});
