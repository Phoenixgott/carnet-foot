/**
 * Phase 3 de bout en bout : nouveau modèle affiché à côté du carnet, critères réglables,
 * poids des absents, tri par intérêt, comparaison, fiche équipe et avantage du terrain des CSV.
 */
import { expect, test, type Page } from "playwright/test";

const DATE = "2030-05-04";

function equipe(nom: string, marques = 16, encaisses = 14, pct15 = 80, pct25 = 60) {
  return { nom, joues: 10, marques, encaisses, pctOver15: pct15, pctOver25: pct25, derniersButsMarques: [2, 1, 2, 2] };
}
function match(dom: string, ext: string, extra: Record<string, unknown> = {}) {
  return {
    id: `${DATE}-${dom}-${ext}`.toLowerCase().replace(/ /g, ""),
    date: DATE,
    heure: "21:00",
    ligue: "Ligue 1",
    moyenneButsLigue: 2.85,
    domicile: equipe(dom),
    exterieur: equipe(ext),
    h2h: { joues: 6, over25: 5 },
    contexte: "normal",
    absents: [],
    absenceOffensive: false,
    meilleurButeurAbsent: false,
    defenseAffaiblie: false,
    ...extra,
  };
}

async function importer(page: Page, matchs: unknown[]) {
  await page.goto("/#/matchs");
  const rec = page.locator('[data-test="recuperer"]');
  if ((await rec.getAttribute("open")) === null) await rec.locator("> summary").click();
  await page.fill("#reponse-claude", "```json\n" + JSON.stringify({ matchs }) + "\n```");
  await page.locator('[data-test="apercu-matchs"]').waitFor();
  await page.getByRole("button", { name: /^Enregistrer/ }).first().click();
  await page.locator('[data-test="resultat-matchs"]').waitFor();
  await rec.locator("> summary").click();
}

const carte = (page: Page, nom: string) => page.locator("article.match", { hasText: nom });

test("Nouveau modèle : chances et fourchette, cote juste et mini, value, chiffres du carnet à côté, détail du calcul", async ({ page }) => {
  await importer(page, [match("Lens", "Brest", { cotes: { over25: 3.5, under25: 1.3, bookmaker: "Unibet" } })]);
  const m25 = carte(page, "Lens").locator('[data-test="methode-+2.5"]');
  await expect(m25.locator('[data-test="chances"]')).toHaveText(/^\d+ % \(\d+-\d+ %\)$/);
  await expect(m25.locator('[data-test="cotes-calculees"]')).toHaveText(/^\d,\d\d · \d,\d\d$/);
  await expect(m25.locator('[data-test="value"]')).toHaveText(/^3,50 · \+\d+ %$/);
  await expect(m25.locator('[data-test="why"]')).toHaveText(/^Oui : la cote 3,50 donne une value de \+\d+ %/);
  await expect(m25.locator('[data-test="carnet"]')).toHaveText(/^Carnet : \d+ % · cote mini \d,\d\d$/);
  await m25.getByText("Pourquoi ?").click();
  await expect(m25.locator(".pourquoi")).toContainText("Avantage du terrain : 1,25 (valeur moyenne");
  await expect(m25.locator(".pourquoi")).toContainText("Mélange 70 / 30");
  await expect(m25.locator(".pourquoi")).toContainText("Le bookmaker, marge retirée, estime");
  // Cote 3,50 / 1,30 : le bookmaker estime ~27 %, loin du modèle → avertissement
  await expect(m25.locator(".pourquoi")).toContainText("points d'écart avec le bookmaker");
  await expect(carte(page, "Lens").locator('[data-test="lambda"]')).toHaveText(/^\d,\d\d ± \d,\d\d$/);
  const m15 = carte(page, "Lens").locator('[data-test="methode-+1.5"]');
  await expect(m15.locator('[data-test="why"]')).toHaveText(/entre en live à \d,\d\d ou plus\.$/);
});

test("Critères réglables : un seuil plus exigeant change le verdict, retour aux critères du carnet", async ({ page }) => {
  await importer(page, [match("Lens", "Brest")]);
  const m15 = carte(page, "Lens").locator('[data-test="methode-+1.5"]');
  await expect(m15.locator(".verdict")).toContainText("On joue");
  await page.goto("/#/reglages");
  await page.fill("#seuil-15-pctPlus15", "95");
  await page.getByRole("button", { name: "Enregistrer les critères" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Critères enregistrés");
  await page.goto("/#/matchs");
  await expect(m15.locator(".verdict")).toContainText("On passe");
  await expect(m15.locator('[data-test="why"]')).toHaveText("Non : trop de matchs à 0 ou 1 but.");
  await m15.getByText("Pourquoi ?").click();
  await expect(m15.locator(".pourquoi")).toContainText("Minimum : 95 %.");
  // Saisie refusée avec un message clair
  await page.goto("/#/reglages");
  await page.fill("#seuil-25-scoreOk", "2,5");
  await page.getByRole("button", { name: "Enregistrer les critères" }).click();
  await expect(page.getByRole("alert")).toContainText("tape un nombre entier de 1 à 6");
  await page.getByRole("button", { name: "Revenir aux critères du carnet" }).click();
  await expect(page.locator("#seuil-15-pctPlus15")).toHaveValue("70");
  await page.goto("/#/matchs");
  await expect(m15.locator(".verdict")).toContainText("On joue");
});

test("Poids des absents : les buts attendus suivent le réglage", async ({ page }) => {
  await importer(page, [match("Lens", "Brest", { meilleurButeurAbsent: true, absenceOffensive: true })]);
  const lambda = async () => Number((await carte(page, "Lens").locator('[data-test="lambda"]').textContent())!.split(" ")[0].replace(",", "."));
  const normal = await lambda();
  await page.goto("/#/reglages");
  await page.getByRole("button", { name: "Ignorés" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Poids des absents : ignorés");
  await page.goto("/#/matchs");
  const ignores = await lambda();
  await page.goto("/#/reglages");
  await page.getByRole("button", { name: "Très fort" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Poids des absents : très fort");
  await page.goto("/#/matchs");
  const fort = await lambda();
  expect(ignores).toBeGreaterThan(normal);
  expect(normal).toBeGreaterThan(fort);
});

test("Tri par intérêt et comparaison de deux matchs", async ({ page }) => {
  await importer(page, [
    match("Metz", "Lille", { moyenneButsLigue: 2.2, h2h: { joues: 6, over25: 1 }, domicile: equipe("Metz", 6, 8, 50, 30), exterieur: equipe("Lille", 7, 6, 50, 30) }),
    match("Lens", "Brest", { heure: "22:00", cotes: { over25: 3.5, under25: 1.3 } }),
    match("Nice", "Lyon", { heure: "18:00", meilleurButeurAbsent: true }),
  ]);
  await expect(page.locator("article.match").first()).toContainText("Nice");
  await page.getByRole("button", { name: "Par intérêt" }).click();
  const premiere = page.locator("article.match").first();
  await expect(premiere).toContainText("Lens");
  await expect(premiere.locator('[data-test="rang"]')).toHaveText(/^n° 1 · \+2\.5 : On joue, value \+\d+ %/);
  await expect(page.locator("article.match").last()).toContainText("Metz");

  await carte(page, "Lens").getByRole("button", { name: "Comparer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Choisis un 2ᵉ match" })).toBeVisible();
  await carte(page, "Metz").getByRole("button", { name: "Comparer" }).click();
  const comp = page.locator('[data-test="comparaison"]');
  await expect(comp.locator("thead")).toContainText("Lens – Brest");
  await expect(comp.locator("thead")).toContainText("Metz – Lille");
  await expect(comp.getByRole("row", { name: /\+2\.5 : verdict/ })).toContainText("✅ On joue");
  await expect(comp.getByRole("row", { name: /\+2\.5 : verdict/ })).toContainText("❌ On passe");
  await comp.getByRole("button", { name: "Fermer la comparaison" }).click();
  await expect(comp).toHaveCount(0);
});

/** 40 matchs de Ligue 1 2025-2026 : 60 buts à domicile pour 40 à l'extérieur (avantage 1,5). */
function csvLigue1(): string {
  const equipes = ["Paris SG", "Lens", "Marseille", "Lyon", "Rennes", "Nice", "Lille", "Monaco"];
  const lignes = ["Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR"];
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.UTC(2025, 7, 10 + i));
    const date = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    const dom = equipes[i % 8];
    const ext = equipes[(i + 1 + Math.floor(i / 8)) % 8] === dom ? equipes[(i + 2) % 8] : equipes[(i + 1 + Math.floor(i / 8)) % 8];
    const [bd, be] = i % 2 ? [2, 1] : [1, 1];
    lignes.push(`F1,${date},20:00,${dom},${ext},${bd},${be},${bd > be ? "H" : "D"},${Math.min(bd, 1)},0,D`);
  }
  // Une 2ᵉ confrontation Paris SG – Lens (la 1re, 1-1, est dans la boucle)
  lignes.push("F1,20/09/2025,21:00,Lens,Paris SG,3,2,H,1,1,D");
  return lignes.join("\n");
}

test("Historiques : avantage du terrain du championnat dans le calcul, fiche équipe avec forme, séries et confrontations", async ({ page }) => {
  await page.goto("/#/donnees");
  await page.locator('[data-test="fichiers-csv"]').setInputFiles([{ name: "F1.csv", mimeType: "text/csv", buffer: Buffer.from(csvLigue1()) }]);
  await page.getByRole("button", { name: /^Enregistrer \d+ résultats/ }).click();
  await expect(page.locator('[data-test="historiques-enregistres"]')).toContainText("Ligue 1 2025-2026");

  await importer(page, [match("PSG", "RC Lens")]);
  const m25 = carte(page, "PSG").locator('[data-test="methode-+2.5"]');
  await m25.getByText("Pourquoi ?").click();
  await expect(m25.locator(".pourquoi")).toContainText(/Avantage du terrain : 1,\d\d buts à domicile pour 1,\d\d à l'extérieur \(41 matchs, 2025-2026\)/);

  await carte(page, "PSG").getByRole("link", { name: "PSG", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "PSG" })).toBeVisible();
  await expect(page.getByText("Dans les historiques : « Paris SG ».")).toBeVisible();
  await expect(page.locator('[data-test="forme"] p.forme .pastille-ico')).toHaveCount(10);
  await expect(page.locator('[data-test="confrontations"]')).toContainText("2 confrontations dans tes historiques, dont 1 à 3 buts ou plus.");
  await expect(page.locator('[data-test="confrontations"]')).toContainText("D 2-3");
  await expect(page.locator('[data-test="series"]')).toBeVisible();
  await page.getByRole("link", { name: "← Retour aux matchs" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Matchs" })).toBeVisible();

  // Équipe sans historique : dit clairement, sans rien deviner
  await page.goto("/#/equipe?nom=Inconnue%20FC");
  await expect(page.locator('[data-test="pas-d-historique"]')).toBeVisible();
});
