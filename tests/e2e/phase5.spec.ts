/**
 * Phase 5 de bout en bout : calculateur freebet (remboursé ou non, exchange), comparateur de matchs,
 * suivi des offres (statuts, délais, bilan), rappels (accueil, notification), fichier d'agenda,
 * sauvegarde, et réimport du carnet qui ne doit pas effacer les offres.
 */
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "playwright/test";
import { donneesCarnet, exporterDepuisCarnet, importerDansApp, ouvrirCarnet } from "./outils";

/** Date locale du navigateur dans `n` jours (AAAA-MM-JJ). */
const dans = (page: Page, n: number) =>
  page.evaluate((jours) => {
    const d = new Date();
    d.setDate(d.getDate() + jours);
    const z = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }, n);

async function remplir(page: Page, champs: Record<string, string>) {
  for (const [id, v] of Object.entries(champs)) await page.fill("#" + id, v);
}

test("Navigation : Freebet dans la barre, Réglages en engrenage dans l'en-tête", async ({ page }) => {
  await page.goto("/#/accueil");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav.getByRole("link")).toHaveText(["Accueil", "Matchs", "Live", "Freebet", "Paris", "Données"]);
  await page.getByRole("banner").getByRole("link", { name: "Réglages" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Réglages" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Freebet" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Freebet" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Freebet" })).toHaveAttribute("aria-current", "page");
});

test("Calculateur : exemple du carnet, coût du pari qui débloque, conversion, messages", async ({ page }) => {
  await page.goto("/#/freebet");
  await expect(page.locator('[data-test="calcul-a-saisir"]')).toBeVisible();
  await remplir(page, { "fb-q-mise": "100", "fb-q-cote": "2,05", "fb-q-inverse": "1,95", "fb-f-montant": "100", "fb-f-cote": "4,50", "fb-f-inverse": "1,30" });

  await expect(page.locator('[data-test="rep-qualif"]')).toContainText("Mise 105,13 €");
  await expect(page.locator('[data-test="rep-qualif"]')).toContainText("Quoi qu'il arrive : −0,13 €, c'est le prix pour débloquer le freebet");
  await expect(page.locator('[data-test="rep-freebet"]')).toContainText("Mise 269,23 €");
  await expect(page.locator('[data-test="rep-freebet"]')).toContainText("tu gagnes 80,77 €");
  await expect(page.locator('[data-test="bilan-cout"]')).toHaveText("0,13 €");
  await expect(page.locator('[data-test="bilan-gain"]')).toHaveText("80,77 €");
  await expect(page.locator('[data-test="bilan-total"]')).toHaveText("80,64 €");
  await expect(page.locator('[data-test="bilan-conversion"]')).toHaveText("81 %");
  await expect(page.locator('[data-test="bilan-conversion-nette"]')).toHaveText("81 %");
  await expect(page.locator('[data-test="appreciation"]')).toContainText("Bonne opération");

  // Freebet remboursé : la mise est rendue en cas de gain (paie 450 au lieu de 350)
  await page.getByRole("button", { name: "Oui (remboursé)" }).click();
  await expect(page.locator('[data-test="rep-freebet"]')).toContainText("Mise 346,15 €");
  await expect(page.locator('[data-test="bilan-gain"]')).toHaveText("103,85 €");
  await expect(page.locator('[data-test="bilan-total"]')).toHaveText("103,72 €");
  await page.getByRole("button", { name: "Non (cas courant)" }).first().click();
  await expect(page.locator('[data-test="bilan-gain"]')).toHaveText("80,77 €");

  // Conversion moyenne : cote plus basse → « À améliorer »
  await page.fill("#fb-f-cote", "2");
  await page.fill("#fb-f-inverse", "2");
  await expect(page.locator('[data-test="appreciation"]')).toContainText("À améliorer");
  await expect(page.locator('[data-test="appreciation"]')).toContainText("Cherche un match où les deux cotes sont plus proches.");

  // Saisie impossible : message clair, aucun chiffre
  await page.fill("#fb-f-cote", "1");
  await expect(page.locator('[data-test="calcul-erreur"]')).toHaveText("La cote du freebet doit être supérieure à 1.");
  await expect(page.locator('[data-test="bilan-total"]')).toHaveCount(0);

  // Boutons − et + des cotes
  await page.fill("#fb-f-cote", "3,00");
  await page.getByRole("button", { name: "Augmenter : Cote chez le bookmaker de l'offre" }).nth(1).click();
  await expect(page.locator("#fb-f-cote")).toHaveValue("3,05");

  // Exchange : commission demandée, somme à bloquer indiquée
  await page.getByRole("button", { name: "Exchange (lay)" }).click();
  await expect(page.locator("#fb-q-comm")).toHaveValue("5");
  await page.fill("#fb-q-inverse", "2,10");
  await page.fill("#fb-f-cote", "4,50");
  await page.fill("#fb-f-inverse", "4,70");
  await expect(page.locator('[data-test="rep-freebet"]')).toContainText("en lay sur l'exchange");
  await expect(page.locator('[data-test="rep-freebet"]')).toContainText(/Il faut \d+,\d\d € sur ton compte exchange\./);
  await expect(page.locator('[data-test="bilan-total"]')).toBeVisible();
});

const cotes = (over15: number, under15: number, over25: number, under25: number) => ({ over15, under15, over25, under25, bookmaker: "Unibet" });
const match = (dom: string, ext: string, c: unknown, date = "2030-05-04") => ({
  id: `${date}-${dom}-${ext}`.toLowerCase(),
  date,
  heure: "21:00",
  ligue: "Ligue 1",
  domicile: { nom: dom },
  exterieur: { nom: ext },
  cotes: c,
});

async function importer(page: Page, matchs: unknown[]) {
  await page.goto("/#/matchs");
  const rec = page.locator('[data-test="recuperer"]');
  if ((await rec.getAttribute("open")) === null) await rec.locator("> summary").click();
  await page.fill("#reponse-claude", "```json\n" + JSON.stringify({ matchs }) + "\n```");
  await page.locator('[data-test="apercu-matchs"]').waitFor();
  await page.getByRole("button", { name: /^Enregistrer/ }).first().click();
  await page.locator('[data-test="resultat-matchs"]').waitFor();
}

test("Comparateur : classement par conversion, cote minimale de l'offre, envoi vers le calculateur", async ({ page }) => {
  await page.goto("/#/freebet");
  await page.getByRole("button", { name: "Comparateur" }).click();
  await expect(page.getByText("Aucun match chargé.")).toBeVisible();

  await importer(page, [
    match("Lens", "Brest", cotes(1.25, 3.8, 2.6, 1.6)),
    match("Metz", "Lille", cotes(1.3, 3.4, 1.8, 2.0), "2030-05-05"),
    { ...match("Nice", "Lyon", null), cotes: { over25: 2.0, bookmaker: "Unibet" } }, // un seul côté : non évaluable
    match("Passe", "Vieux", cotes(1.25, 3.8, 2.6, 1.6), "2020-01-01"),
  ]);
  await page.goto("/#/freebet");
  await page.getByRole("button", { name: "Comparateur" }).click();
  await expect(page.locator('[data-test="cmp-a-saisir"]')).toBeVisible();
  await page.fill("#cmp-montant", "10");

  const lignes = page.locator('[data-test="candidats"] > li');
  await expect(lignes).toHaveCount(8); // Lens et Metz : 2 lignes × 2 côtés chacun
  // Meilleure : Lens, plus de 2,5 buts à 2,60 (couverture à 1,60) : (1,6 × 0,6) / 1,6 = 60 %
  const premiere = lignes.first();
  await expect(premiere).toContainText("1. LENS – BREST".replace("LENS – BREST", "Lens – Brest"));
  await expect(premiere.locator('[data-test="candidat-conversion"]')).toHaveText("60 %");
  await expect(premiere).toContainText("plus de 2,5 buts à 2,60");
  await expect(premiere).toContainText("Mise de couverture10,00 €");
  await expect(premiere).toContainText("Gain garanti6,00 €");
  await expect(premiere).toContainText("Marge du bookmaker1,0 %");
  // Nice n'a qu'un côté ; le match passé est ignoré
  await expect(page.locator('[data-test="cmp-sans-cotes"]')).toContainText("1 match sans les cotes");

  // Cote minimale de l'offre : 2 → les freebets à cote plus basse sont écartés
  await page.fill("#cmp-cote-min", "2");
  await expect(page.locator('[data-test="cmp-ecartees"]')).toContainText("combinaisons écartées");
  const conversions = await page.locator('[data-test="candidat-conversion"]').allTextContents();
  const coteFreebets = await page.locator("ol.candidats .fait", { hasText: "Freebet sur" }).locator("b").allTextContents();
  for (const t of coteFreebets) expect(Number(t.split(" à ")[1].replace(",", "."))).toBeGreaterThanOrEqual(2);
  expect(conversions.length).toBeGreaterThan(0);

  // Envoi vers le calculateur : cotes du match préremplies
  await lignes.first().getByRole("button", { name: "Calculer avec ce match" }).click();
  await expect(page.locator('[data-test="calculateur"]')).toBeVisible();
  await expect(page.locator("#fb-f-cote")).toHaveValue("2,60");
  await expect(page.locator("#fb-f-inverse")).toHaveValue("1,60");
  await expect(page.locator("#fb-f-montant")).toHaveValue("10");
  await expect(page.locator('[data-test="rep-freebet"]')).toContainText("Quoi qu'il arrive, tu gagnes 6,00 €");
});

async function ajouterOffre(page: Page, o: { bookmaker: string; titre?: string; montant?: string; qualif?: string; coteMin?: string; date?: string; conditions?: string }) {
  await page.getByRole("button", { name: "Ajouter une offre" }).click();
  await remplir(page, { "offre-bookmaker": o.bookmaker, "offre-titre": o.titre ?? "", "offre-montant": o.montant ?? "", "offre-qualif": o.qualif ?? "", "offre-cote-min": o.coteMin ?? "", "offre-conditions": o.conditions ?? "" });
  if (o.date) await page.fill("#offre-date", o.date);
  await page.getByRole("button", { name: "Enregistrer l'offre" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Offre ajoutée");
}

test("Offres : ajout, délais, rappel sur l'accueil, statuts, bilan, agenda, calcul, suppression", async ({ page }) => {
  await page.goto("/#/freebet");
  await page.getByRole("button", { name: "Offres" }).click();
  await expect(page.locator('[data-test="offres-vide"]')).toBeVisible();

  // Validation : le bookmaker est obligatoire, les autres champs sont vérifiés
  await page.getByRole("button", { name: "Ajouter une offre" }).click();
  await page.getByRole("button", { name: "Enregistrer l'offre" }).click();
  await expect(page.getByRole("alert")).toHaveText("Indique le bookmaker.");
  await page.fill("#offre-bookmaker", "Unibet");
  await page.fill("#offre-cote-min", "1");
  await page.getByRole("button", { name: "Enregistrer l'offre" }).click();
  await expect(page.getByRole("alert")).toContainText("Cote minimale");
  await page.getByRole("button", { name: "Annuler" }).click();

  const dans2 = await dans(page, 2);
  const dans30 = await dans(page, 30);
  const hier = await dans(page, -1);
  await ajouterOffre(page, { bookmaker: "Unibet", titre: "Freebet 10 €", montant: "10", qualif: "10", coteMin: "1,5", date: dans2, conditions: "Pari simple" });
  await ajouterOffre(page, { bookmaker: "Winamax", titre: "Freebet 20 €", montant: "20", date: dans30 });
  await ajouterOffre(page, { bookmaker: "Betclic", montant: "5", date: hier });
  await ajouterOffre(page, { bookmaker: "PMU" });

  // Tri : urgent, lointain, sans date, expirée en dernier
  const liste = page.locator('[data-test="liste-offres"] > li');
  await expect(liste).toHaveCount(4);
  await expect(liste.nth(0)).toContainText("Unibet");
  await expect(liste.nth(0)).toHaveAttribute("data-etat", "urgente");
  await expect(liste.nth(0).locator('[data-test="delai"]')).toHaveText("expire dans 2 jours");
  await expect(liste.nth(0)).toContainText("Urgent");
  await expect(liste.nth(1)).toContainText("Winamax");
  await expect(liste.nth(1).locator('[data-test="delai"]')).toHaveText("expire dans 30 jours");
  await expect(liste.nth(2)).toContainText("PMU");
  await expect(liste.nth(3)).toContainText("Betclic");
  await expect(liste.nth(3)).toHaveAttribute("data-etat", "expiree");
  await expect(liste.nth(3).locator('[data-test="delai"]')).toHaveText("expirée depuis hier");
  await expect(page.locator('[data-test="nb-en-cours"]')).toHaveText("3");
  await expect(page.locator('[data-test="a-utiliser"]')).toHaveText("30,00 €"); // 10 + 20 ; l'expirée n'est plus à utiliser

  // Rappel sur l'accueil : seulement l'offre qui expire dans les 3 jours
  await page.goto("/#/accueil");
  const rappel = page.locator('[data-test="offres-bientot"]');
  await expect(rappel).toContainText("Un freebet expire bientôt");
  await expect(rappel).toContainText("Unibet · Freebet 10 € (10,00 €) : expire dans 2 jours");
  await expect(rappel).not.toContainText("Winamax");
  await rappel.getByRole("link", { name: "Voir mes offres" }).click();
  await expect(page.locator('[data-test="offres"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /^Offres \(4\)/ })).toBeVisible();

  // Fichier d'agenda avec alarmes
  const [telechargement] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Ajouter l'offre Unibet à l'agenda" }).click(),
  ]);
  expect(telechargement.suggestedFilename()).toBe(`freebet-unibet-${dans2}.ics`);
  const ics = readFileSync((await telechargement.path())!, "utf8");
  expect(ics).toContain("BEGIN:VEVENT");
  expect(ics).toContain(`DTSTART;VALUE=DATE:${dans2.replace(/-/g, "")}`);
  expect(ics).toContain("SUMMARY:Freebet à utiliser : Unibet : Freebet 10 €");
  expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
  expect(ics).toContain("TRIGGER:-PT15H");

  // Calculer depuis l'offre : montant et mise préremplis, cote minimale contrôlée
  await liste.nth(0).getByRole("button", { name: "Calculer" }).click();
  await expect(page.locator('[data-test="offre-du-calcul"]')).toContainText("Unibet · Freebet 10 € · freebet de 10,00 € · cote minimale 1,50 · expire dans 2 jours");
  await expect(page.locator("#fb-f-montant")).toHaveValue("10,00");
  await expect(page.locator("#fb-q-mise")).toHaveValue("10,00");
  await page.fill("#fb-f-cote", "1,30");
  await expect(page.locator('[data-test="sous-cote-min"]')).toContainText("sous la cote minimale de l'offre (1,50)");
  await page.fill("#fb-f-cote", "4,50");
  await expect(page.locator('[data-test="sous-cote-min"]')).toHaveCount(0);

  // Statut, puis terminer avec le bénéfice réel : le bilan suit
  await page.getByRole("button", { name: /^Offres/ }).click();
  await page.getByLabel("Statut de l'offre Unibet").selectOption("freebet-recu");
  await expect(page.locator('[data-test="toast"]')).toHaveText("Statut : freebet reçu");
  await page.getByRole("button", { name: "Modifier l'offre Unibet" }).click();
  await page.selectOption("#offre-statut", "terminee");
  await page.fill("#offre-benefice", "6,5");
  await page.getByRole("button", { name: "Enregistrer l'offre" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Offre modifiée");
  await expect(page.locator('[data-test="benefice-realise"]')).toHaveText("6,50 €");
  await expect(page.locator('[data-test="conversion-moyenne"]')).toHaveText("65 %"); // 6,5 / 10
  await expect(page.locator('[data-test="liste-offres"] > li').last()).toContainText("Unibet");
  await expect(page.locator('[data-test="liste-offres"] > li').last()).toContainText("Bénéfice réel6,50 €");
  // Plus de rappel pour une offre terminée
  await page.goto("/#/accueil");
  await expect(page.locator('[data-test="offres-bientot"]')).toHaveCount(0);

  // Suppression avec confirmation
  await page.goto("/#/freebet?vue=offres");
  await expect(page.getByRole("button", { name: "Ajouter une offre" })).toBeVisible();
  await page.getByRole("button", { name: "Supprimer l'offre PMU" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
  await expect(page.locator('[data-test="liste-offres"] > li')).toHaveCount(4);
  await page.getByRole("button", { name: "Supprimer l'offre PMU" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.locator('[data-test="liste-offres"] > li')).toHaveCount(3);

  // Les offres survivent à la fermeture de l'app (l'app rouvre sur le calculateur)
  await page.reload();
  await page.getByRole("button", { name: /^Offres/ }).click();
  await expect(page.locator('[data-test="liste-offres"] > li')).toHaveCount(3);
});

test("Offres : dans la sauvegarde, et un réimport du carnet ne les efface pas", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:4173" });
  await page.goto("/#/freebet?vue=offres");
  await ajouterOffre(page, { bookmaker: "Unibet", montant: "10", date: await dans(page, 10) });
  // Un réglage d'apparence, lui aussi propre à l'app
  await page.goto("/#/reglages");
  await page.getByRole("button", { name: "Sombre" }).click();

  // Sauvegarde : le texte contient les offres
  await page.goto("/#/donnees");
  await page.getByRole("button", { name: "Copier le texte" }).click();
  await expect(page.locator('[data-test="toast"]')).toHaveText("Sauvegarde copiée");
  const sauvegarde = await page.evaluate(() => navigator.clipboard.readText());
  const contenu = JSON.parse(sauvegarde).contenu;
  expect(contenu.reglages.find((r: { cle: string }) => r.cle === "offres").valeur[0].bookmaker).toBe("Unibet");

  // Import du carnet : les offres et le thème restent
  const carnet = await ouvrirCarnet(context, donneesCarnet(41, 6, 2));
  await importerDansApp(page, await exporterDepuisCarnet(carnet));
  await expect(page.locator('[data-test="resultat-import"]')).toContainText("Import réussi");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/#/freebet?vue=offres");
  await expect(page.locator('[data-test="liste-offres"] > li')).toHaveCount(1);
  await expect(page.locator('[data-test="liste-offres"] > li').first()).toContainText("Unibet");
});

test("Rappel : une seule notification par jour quand l'app est ouverte", async ({ context, page }) => {
  await context.grantPermissions(["notifications"], { origin: "http://localhost:4173" });
  await page.goto("/#/reglages");
  await expect(page.locator('[data-test="etat-hors-ligne"]')).toHaveText("Prête", { timeout: 15_000 });
  await page.goto("/#/freebet?vue=offres");
  await ajouterOffre(page, { bookmaker: "Unibet", titre: "Freebet 10 €", montant: "10", date: await dans(page, 2) });
  const notifications = () =>
    page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title} | ${n.body}`));
  await expect.poll(notifications).toEqual(["Freebet à utiliser | Unibet : expire dans 2 jours"]);

  // Fermée puis rouverte le même jour : pas de nouvelle notification
  await page.evaluate(async () => {
    for (const n of await (await navigator.serviceWorker.ready).getNotifications()) n.close();
  });
  await page.reload();
  await page.locator("main h1").waitFor();
  await page.waitForTimeout(1500);
  expect(await notifications()).toEqual([]);
  await page.getByRole("button", { name: /^Offres/ }).click();
  await expect(page.locator('[data-test="liste-offres"] > li')).toHaveCount(1);
});
