/**
 * Phase 6 de bout en bout : journal des paris (ajout, modification, suppression, photo du
 * ticket), statistiques avancées, simulateur, réglages de mises et d'objectifs, et intégrations
 * « Noter ce pari » depuis le Live et le Freebet.
 */
import { expect, test, type Page } from "playwright/test";

async function ajouterPari(page: Page, p: { match: string; date?: string; methode?: string; cote: string; mise: string; statut?: string; pnl?: string }) {
  await page.getByRole("button", { name: "Ajouter un pari" }).click();
  await page.fill("#pari-match", p.match);
  if (p.date) await page.fill("#pari-date", p.date);
  if (p.methode) await page.selectOption("#pari-methode", p.methode);
  await page.fill("#pari-cote", p.cote);
  await page.fill("#pari-mise", p.mise);
  if (p.statut) await page.selectOption("#pari-statut", p.statut);
  if (p.pnl) await page.fill("#pari-pnl", p.pnl);
  await page.getByRole("button", { name: "Ajouter le pari" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Pari ajouté");
}

test("Journal : ajout, modification, suppression", async ({ page }) => {
  await page.goto("/#/paris");
  await expect(page.getByText("Aucun pari pour l'instant.")).toBeVisible();

  // Validation : cote et mise vérifiées
  await page.getByRole("button", { name: "Ajouter un pari" }).click();
  await page.fill("#pari-match", "Lens – Brest");
  await page.fill("#pari-cote", "1");
  await page.fill("#pari-mise", "10");
  await page.getByRole("button", { name: "Ajouter le pari" }).click();
  await expect(page.getByRole("alert")).toContainText("Cote");
  await page.fill("#pari-cote", "1,85");

  await page.selectOption("#pari-methode", "+1.5");
  await page.selectOption("#pari-statut", "gagne");
  await page.getByRole("button", { name: "Ajouter le pari" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Pari ajouté");
  await expect(page.locator(".pari")).toHaveCount(1);
  await expect(page.locator(".pari")).toContainText("Lens – Brest");
  await expect(page.locator(".pari")).toContainText("Gagné");
  await expect(page.locator(".pari .pari-gain")).toHaveText("8,50 €"); // 10 × (1,85 − 1)
  await expect(page.locator('[data-test="bankroll-paris"]')).toHaveText("208,50 €");

  // Gain sécurisé (statut « manuel ») : champ pnl demandé, signe négatif accepté
  await ajouterPari(page, { match: "Metz – Lille", cote: "3,00", mise: "20", statut: "manuel" });
  await page.getByRole("button", { name: "Modifier le pari Metz – Lille" }).click();
  await page.getByRole("button", { name: "Ajouter le pari", exact: false }).first();
  await expect(page.locator('[data-test="form-pari"] h3')).toHaveText("Modifier le pari");
  await page.fill("#pari-pnl", "−4,5");
  await page.getByRole("button", { name: "Enregistrer le pari" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Pari modifié");
  await expect(page.locator(".pari", { hasText: "Metz" }).locator(".pari-gain")).toHaveText("−4,50 €");

  // Suppression avec confirmation
  await page.getByRole("button", { name: "Supprimer le pari Metz – Lille" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
  await expect(page.locator(".pari")).toHaveCount(2);
  await page.getByRole("button", { name: "Supprimer le pari Metz – Lille" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.locator(".pari")).toHaveCount(1);

  // Survit au rechargement
  await page.reload();
  await expect(page.locator(".pari")).toHaveCount(1);
});

test("Journal : lier un pari à un match chargé remplit le texte et la compétition", async ({ page }) => {
  await page.goto("/#/matchs");
  const rec = page.locator('[data-test="recuperer"]');
  if ((await rec.getAttribute("open")) === null) await rec.locator("> summary").click();
  const m = { id: "2030-05-04-lens-brest", date: "2030-05-04", heure: "21:00", ligue: "Ligue 1", domicile: { nom: "Lens" }, exterieur: { nom: "Brest" } };
  await page.fill("#reponse-claude", "```json\n" + JSON.stringify({ matchs: [m] }) + "\n```");
  await page.locator('[data-test="apercu-matchs"]').waitFor();
  await page.getByRole("button", { name: /^Enregistrer/ }).first().click();
  await page.locator('[data-test="resultat-matchs"]').waitFor();

  await page.goto("/#/paris");
  await page.getByRole("button", { name: "Ajouter un pari" }).click();
  await page.selectOption("#pari-match-lie", m.id);
  await expect(page.locator("#pari-match")).toHaveValue("Lens – Brest");
  await expect(page.locator("#pari-date")).toHaveValue("2030-05-04");
  await page.fill("#pari-cote", "1,80");
  await page.fill("#pari-mise", "10");
  await page.getByRole("button", { name: "Ajouter le pari" }).click();
  await expect(page.locator(".pari")).toContainText("Ligue 1");
});

test("Photo du ticket : ajoutée, visible dans la liste, retirable", async ({ page }) => {
  await page.goto("/#/paris");
  await ajouterPari(page, { match: "Nice – Lyon", cote: "2,00", mise: "10", statut: "gagne" });
  await page.getByRole("button", { name: "Modifier le pari Nice – Lyon" }).click();
  // PNG 2×2 minuscule, encodé en base64
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4AWL6z8DwH4SZGKAAAAAA//8qMqaOAAAABklEQVQDADYSBAFv606fAAAAAElFTkSuQmCC",
    "base64",
  );
  await page.locator('input[type="file"]').setInputFiles({ name: "ticket.png", mimeType: "image/png", buffer: png });
  await expect(page.locator('[data-test="form-pari"] img')).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer le pari" }).click();
  await expect(page.locator(".pari", { hasText: "Nice" }).locator("img.pari-photo")).toBeVisible();

  await page.getByRole("button", { name: "Modifier le pari Nice – Lyon" }).click();
  await expect(page.locator('[data-test="form-pari"] img')).toBeVisible();
  await page.getByRole("button", { name: "Retirer la photo" }).click();
  await page.getByRole("button", { name: "Enregistrer le pari" }).click();
  await expect(page.locator(".pari", { hasText: "Nice" }).locator("img.pari-photo")).toHaveCount(0);
});

test("Statistiques : courbe, drawdown, séries, ventilations par méthode, compétition, jour, tranche de cote", async ({ page }) => {
  await page.goto("/#/paris");
  // V V D D D V, méthodes et cotes variées, une compétition renseignée
  await ajouterPari(page, { match: "A – B", date: "2026-09-21", methode: "+2.5", cote: "2,00", mise: "10", statut: "gagne" }); // lundi, +10
  await ajouterPari(page, { match: "C – D", date: "2026-09-22", methode: "+1.5", cote: "1,40", mise: "10", statut: "gagne" }); // mardi, +4
  await ajouterPari(page, { match: "E – F", date: "2026-09-23", methode: "+2.5", cote: "3,00", mise: "10", statut: "perdu" }); // mercredi, -10
  await ajouterPari(page, { match: "G – H", date: "2026-09-24", methode: "+2.5", cote: "3,00", mise: "10", statut: "perdu" }); // jeudi, -10
  await ajouterPari(page, { match: "I – J", date: "2026-09-25", methode: "+2.5", cote: "6,00", mise: "10", statut: "perdu" }); // vendredi, -10
  await ajouterPari(page, { match: "K – L", date: "2026-09-26", methode: "+2.5", cote: "1,40", mise: "10", statut: "gagne" }); // samedi, +4

  await page.getByRole("button", { name: "Statistiques" }).click();
  await expect(page.locator('[data-test="drawdown"]')).toHaveText("30,00 €"); // sommet 214 (200+10+4) → creux 184 (-30)
  await expect(page.locator('[data-test="serie-actuelle"]')).toContainText("1");
  await expect(page.locator('[data-test="serie-actuelle"]')).toContainText("victoires");
  await expect(page.getByText("3 défaites")).toBeVisible(); // pire série
  await expect(page.getByText("2 victoires").last()).toBeVisible(); // meilleure série (les 2 premiers paris)

  await expect(page.getByRole("heading", { name: "Par méthode" })).toBeVisible();
  const ventMethode = page.locator('[data-test="ventilation"]').first();
  await expect(ventMethode).toContainText("+2.5");
  await expect(ventMethode).toContainText("−16,00 €"); // +2.5 : +10 -10 -10 -10 +4 = -16
  await expect(ventMethode).toContainText("4,00 €"); // +1.5 seul : +4
  await expect(page.getByRole("heading", { name: "Par jour de la semaine" })).toBeVisible();
  const ventJour = page.locator('section:has(h3:text("Par jour de la semaine")) [data-test="ventilation"]');
  await expect(ventJour).toContainText("Lundi");
  await expect(ventJour).toContainText("Samedi");
  await expect(page.getByRole("heading", { name: "Par tranche de cote" })).toBeVisible();
  const ventTranche = page.locator('section:has(h3:text("Par tranche de cote")) [data-test="ventilation"]');
  await expect(ventTranche).toContainText("moins de 1,5");
  await expect(ventTranche).toContainText("5 et plus");
  const ventCompet = page.locator('section:has(h3:text("Par compétition")) [data-test="ventilation"]');
  await expect(ventCompet).toContainText("Compétition inconnue");

  // Le détail de la courbe (table accessible) liste chaque pari
  await page.locator('[data-test="statistiques"] summary', { hasText: "Voir le détail" }).click();
  await expect(page.locator('[data-test="statistiques"] table tbody tr')).toHaveCount(7); // départ + 6 paris
});

test("Simulateur : mise fixe et % de la bankroll, comparaison au réel", async ({ page }) => {
  await page.goto("/#/paris");
  await ajouterPari(page, { match: "A – B", cote: "2,00", mise: "50", statut: "gagne" }); // réel +50
  await ajouterPari(page, { match: "C – D", cote: "2,00", mise: "50", statut: "perdu" }); // réel -50

  await page.getByRole("button", { name: "Simulateur" }).click();
  await expect(page.locator('[data-test="sim-a-saisir"]')).toHaveCount(0); // valeur par défaut déjà remplie
  await page.fill("#sim-montant", "10");
  await expect(page.locator('[data-test="sim-gains"]')).toHaveText("0,00 €"); // +10 -10
  await expect(page.locator('[data-test="sim-drawdown"]')).toHaveText("10,00 €");

  await page.getByRole("button", { name: "% de la bankroll" }).click();
  await page.fill("#sim-pct", "10");
  await page.fill("#sim-depart", "200");
  // 10 % de 200 = 20 → +20 → bankroll 220 ; 10 % de 220 = 22 → -22 → bankroll 198
  await expect(page.locator('[data-test="sim-gains"]')).toHaveText("−2,00 €");
});

test("Réglages Mises et objectifs : Kelly fractionné, plafonds, objectif du mois, persistants", async ({ page }) => {
  await page.goto("/#/reglages");
  const carte = page.locator('[data-test="reglages-mises"]');
  await carte.getByRole("button", { name: "Kelly fractionné" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveCount(0); // changement de méthode silencieux, pas de formulaire à valider
  await page.fill("#mises-fraction", "0,25");
  await page.fill("#mises-plafond-pari", "50");
  await page.fill("#mises-plafond-jour", "100");
  await carte.getByRole("button", { name: "Enregistrer les mises" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Mises enregistrées");

  await page.fill("#objectifs-gain", "50");
  await page.fill("#objectifs-budget", "30");
  await carte.getByRole("button", { name: "Enregistrer les objectifs" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Objectifs enregistrés");

  await page.reload();
  await expect(page.getByRole("button", { name: "Kelly fractionné" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#mises-fraction")).toHaveValue("0,25");
  await expect(page.locator("#mises-plafond-pari")).toHaveValue("50");
  await expect(page.locator("#objectifs-gain")).toHaveValue("50");

  // Plafond par pari : avertissement doux dans le formulaire d'ajout, jamais un blocage
  await page.goto("/#/paris");
  await page.getByRole("button", { name: "Ajouter un pari" }).click();
  await page.fill("#pari-match", "Test plafond");
  await page.fill("#pari-cote", "1,80");
  await page.fill("#pari-mise", "80");
  await expect(page.locator('[data-test="alerte-plafond-pari"]')).toContainText("dépasse ton plafond par pari");
  await page.getByRole("button", { name: "Ajouter le pari" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Pari ajouté"); // pas bloqué
});

const cotesEt = (a: number, b: number, c: number, d: number) => ({ over15: a, under15: b, over25: c, under25: d, bookmaker: "Unibet" });

test("Live : « Noter ce pari » prépare le formulaire d'ajout avec les bonnes valeurs", async ({ page }) => {
  const lens = {
    id: "2030-05-04-lens-brest",
    date: "2030-05-04",
    heure: "21:00",
    ligue: "Ligue 1",
    domicile: { nom: "Lens", joues: 10, marques: 16, encaisses: 14 },
    exterieur: { nom: "Brest", joues: 10, marques: 15, encaisses: 16 },
    cotes: cotesEt(1.25, 3.8, 2.6, 1.6),
  };
  await page.clock.install({ time: new Date("2030-05-04T19:00:00") });
  await page.goto("/#/matchs");
  const rec = page.locator('[data-test="recuperer"]');
  if ((await rec.getAttribute("open")) === null) await rec.locator("> summary").click();
  await page.fill("#reponse-claude", "```json\n" + JSON.stringify({ matchs: [lens] }) + "\n```");
  await page.getByRole("button", { name: /^Enregistrer/ }).first().click();
  await page.locator('[data-test="resultat-matchs"]').waitFor();
  await page.clock.pauseAt(new Date("2030-05-04T19:59:00"));

  await page.goto("/#/live?match=" + lens.id);
  await page.getByRole("button", { name: "Coup d'envoi" }).click();
  await page.clock.fastForward(16 * 60_000);
  await page.clock.fastForward(4000); // laisse le toast « Fenêtre ouverte » se refermer (3,2 s)
  await page.fill("#live-cote", "1,72");
  await page.fill("#live-mise", "20");
  await page.getByRole("button", { name: "J'ai parié" }).click();
  await page.getByRole("button", { name: "Noter ce pari dans mon journal" }).click();
  await expect(page).toHaveURL(/\/#\/paris$/);
  await expect(page.locator('[data-test="form-pari"] h3')).toHaveText("Ajouter un pari");
  await expect(page.locator("#pari-match")).toHaveValue("Lens – Brest");
  await expect(page.locator("#pari-methode")).toHaveValue("+1.5");
  await expect(page.locator("#pari-cote")).toHaveValue("1,72");
  await expect(page.locator("#pari-mise")).toHaveValue("20");
  await expect(page.locator("#pari-statut")).toHaveValue("attente");
  await page.getByRole("button", { name: "Ajouter le pari" }).click();
  await expect(page.locator(".pari")).toContainText("Lens – Brest");
  await expect(page.locator(".pari")).toContainText("En cours");
});

test("Live : un pari couvert et rentable se note comme sécurisé, avec le gain garanti", async ({ page }) => {
  const lens = {
    id: "2030-05-04-lens-brest",
    date: "2030-05-04",
    heure: "21:00",
    ligue: "Ligue 1",
    domicile: { nom: "Lens", joues: 10, marques: 16, encaisses: 14 },
    exterieur: { nom: "Brest", joues: 10, marques: 15, encaisses: 16 },
  };
  await page.clock.install({ time: new Date("2030-05-04T19:00:00") });
  await page.goto("/#/matchs");
  const rec = page.locator('[data-test="recuperer"]');
  if ((await rec.getAttribute("open")) === null) await rec.locator("> summary").click();
  await page.fill("#reponse-claude", "```json\n" + JSON.stringify({ matchs: [lens] }) + "\n```");
  await page.getByRole("button", { name: /^Enregistrer/ }).first().click();
  await page.locator('[data-test="resultat-matchs"]').waitFor();
  await page.clock.pauseAt(new Date("2030-05-04T19:59:00"));
  await page.goto("/#/live?match=" + lens.id);
  await page.getByRole("button", { name: "Coup d'envoi" }).click();
  await page.clock.fastForward(18 * 60_000);
  await page.fill("#live-cote", "1,72");
  await page.fill("#live-mise", "20");
  await page.getByRole("button", { name: "J'ai parié" }).click();
  await page.clock.fastForward(7 * 60_000);
  await page.getByRole("button", { name: "BUT !" }).click();
  await page.fill("#live-contre", "2,60");
  await page.getByRole("button", { name: /^Noter ce pari sécurisé/ }).click();
  await expect(page.locator("#pari-statut")).toHaveValue("manuel");
  await expect(page.locator("#pari-pnl")).toHaveValue("1,17");
  await page.getByRole("button", { name: "Ajouter le pari" }).click();
  await expect(page.locator(".pari")).toContainText("1,17 €");
});

test("Freebet : proposé au journal quand une offre est terminée avec un bénéfice", async ({ page }) => {
  await page.goto("/#/freebet?vue=offres");
  await page.getByRole("button", { name: "Ajouter une offre" }).click();
  await page.fill("#offre-bookmaker", "Winamax");
  await page.fill("#offre-montant", "20");
  await page.getByRole("button", { name: "Enregistrer l'offre" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Offre ajoutée");

  await page.getByRole("button", { name: "Modifier l'offre Winamax" }).click();
  await page.selectOption("#offre-statut", "terminee");
  await page.fill("#offre-benefice", "14,5");
  await page.getByRole("button", { name: "Enregistrer l'offre" }).click();
  await expect(page.getByRole("dialog")).toContainText("Ajouter ce freebet à ton journal ?");
  await expect(page.getByRole("dialog")).toContainText("14,50");
  await page.getByRole("dialog").getByRole("button", { name: "Ajouter au journal" }).click();
  await expect(page).toHaveURL(/\/#\/paris$/);
  await expect(page.locator("#pari-methode")).toHaveValue("Freebet");
  await expect(page.locator("#pari-statut")).toHaveValue("manuel");
  await expect(page.locator("#pari-pnl")).toHaveValue("14,5");
  await expect(page.locator("#pari-match")).toHaveValue("Winamax");
  await page.getByRole("button", { name: "Ajouter le pari" }).click();
  await expect(page.locator(".pari")).toContainText("14,50 €");
});
