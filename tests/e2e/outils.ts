/**
 * Outils communs aux tests de bout en bout : ouvrir le VRAI carnet d'origine,
 * y placer des données réalistes, et récupérer son export complet.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { BrowserContext, Page } from "playwright/test";
import { aleatoire, matchAleatoire, pariCarnetAleatoire } from "../helpers/generateurs";

const CARNET = readFileSync(fileURLToPath(new URL("../fixtures/carnet-original.html", import.meta.url)), "utf8");
/** Même enveloppe que celle ajoutée par la publication de l'artefact. */
const PAGE_CARNET = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${CARNET}</body></html>`;
export const URL_CARNET = "http://carnet.test/";

export interface DonneesCarnet {
  paris: Array<Record<string, unknown>>;
  matchs: Array<Record<string, unknown>>;
  reglages: { bank: number; pct: number };
  ligues: string[];
}

/** Données réalistes au format du carnet : paris variés, matchs complets du jour. */
export function donneesCarnet(graine = 17, nbParis = 30, nbMatchs = 6): DonneesCarnet {
  const r = aleatoire(graine);
  const paris = Array.from({ length: nbParis }, () => pariCarnetAleatoire(r));
  const matchs: Array<Record<string, any>> = [];
  let i = 0;
  while (matchs.length < nbMatchs) {
    const m = matchAleatoire(r, i++) as Record<string, any>;
    if (!m.domicile?.nom || !m.exterieur?.nom) continue;
    if (matchs.some((x) => x.domicile.nom === m.domicile.nom && x.exterieur.nom === m.exterieur.nom)) continue;
    m.date = "2026-09-22";
    m.id = `2026-09-22-${String(m.domicile.nom).toLowerCase()}-${String(m.exterieur.nom).toLowerCase()}`;
    matchs.push(m);
  }
  return { paris, matchs, reglages: { bank: 250, pct: 2.5 }, ligues: ["Ligue 1", "Serie A", "WSL"] };
}

/** Ouvre le carnet d'origine avec ces données dans son stockage local. */
export async function ouvrirCarnet(contexte: BrowserContext, d: DonneesCarnet): Promise<Page> {
  await contexte.route("https://fonts.googleapis.com/**", (r) => r.abort());
  await contexte.route("https://fonts.gstatic.com/**", (r) => r.abort());
  await contexte.route(URL_CARNET, (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: PAGE_CARNET }));
  const p = await contexte.newPage();
  await p.goto(URL_CARNET);
  await p.evaluate((d) => {
    localStorage.setItem("cpf_paris", JSON.stringify(d.paris));
    localStorage.setItem("cpf_matchs3", JSON.stringify({ matchs: d.matchs }));
    localStorage.setItem("cpf_reglages", JSON.stringify(d.reglages));
    localStorage.setItem("cpf_ligues3", JSON.stringify(d.ligues));
  }, d);
  await p.reload();
  return p;
}

/** Clique « Tout exporter » dans le carnet et renvoie le texte exporté. */
export async function exporterDepuisCarnet(carnet: Page): Promise<string> {
  await carnet.click('nav.tabs button[data-tab="suivi"]');
  await carnet.click("#fullExport");
  await carnet.waitForFunction(() => (document.querySelector("#fullExportBox") as HTMLTextAreaElement)?.value.length > 0);
  return carnet.inputValue("#fullExportBox");
}

/**
 * Colle un export dans l'app et lance l'import (additif : ajoute ce qui est nouveau, n'efface
 * et ne remplace jamais un match ou un pari déjà présent) ; renvoie la page sur l'écran Données.
 */
export async function importerDansApp(app: Page, texte: string): Promise<void> {
  await app.goto("/#/donnees");
  await app.fill("#texte-carnet", texte);
  await app.locator('[data-test="apercu-import"]').waitFor();
  await app.locator('[data-test="importer-carnet"]').click();
  await app.locator('[data-test="resultat-import"]').waitFor();
}
