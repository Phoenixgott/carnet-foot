/**
 * Phase 4 de bout en bout : écran live +1.5 avec une horloge de navigateur simulée
 * (les minutes sont exactes, aucune attente réelle) : chronomètre, alertes de fenêtre,
 * décision d'entrée, pari, bouton BUT, couverture (pari contraire, lay, cash-out) et scénarios.
 */
import { expect, test, type Page } from "playwright/test";

const DATE = "2030-05-04";
const MINUTE = 60_000;

function equipe(nom: string) {
  return { nom, joues: 10, marques: 16, encaisses: 14, pctOver15: 80, pctOver25: 60, derniersButsMarques: [2, 1, 2, 2] };
}
const LENS = {
  id: `${DATE}-lens-brest`,
  date: DATE,
  heure: "21:00",
  ligue: "Ligue 1",
  moyenneButsLigue: 2.85,
  domicile: equipe("Lens"),
  exterieur: equipe("Brest"),
  h2h: { joues: 6, over25: 5 },
  contexte: "normal",
  absents: [],
  absenceOffensive: false,
  meilleurButeurAbsent: false,
  defenseAffaiblie: false,
};

/** Colle une réponse de Claude dans « Récupérer les matchs » (ouvert seulement s'il est fermé) et l'enregistre. */
async function importer(page: Page, matchs: unknown[]) {
  const rec = page.locator('[data-test="recuperer"]');
  if ((await rec.getAttribute("open")) === null) await rec.locator("> summary").click();
  await page.fill("#reponse-claude", "```json\n" + JSON.stringify({ matchs }) + "\n```");
  await page.locator('[data-test="apercu-matchs"]').waitFor();
  await page.getByRole("button", { name: /^Enregistrer/ }).first().click();
  await page.locator('[data-test="resultat-matchs"]').waitFor();
}

async function importerLens(page: Page) {
  await page.goto("/#/matchs");
  await importer(page, [LENS]);
}

/** Ouvre une page avec une horloge simulée, figée : le temps n'avance que quand le test le décide. */
async function ouvrirAvecHorloge(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __vibrations: unknown[] }).__vibrations = [];
    navigator.vibrate = (p) => {
      (window as unknown as { __vibrations: unknown[] }).__vibrations.push(p);
      return true;
    };
  });
  await page.clock.install({ time: new Date("2030-05-04T19:00:00") });
  await importerLens(page);
  await page.clock.pauseAt(new Date("2030-05-04T20:00:00"));
}

const minute = (page: Page) => page.locator('[data-test="chrono-minute"]');
const etatFenetre = (page: Page) => page.locator('[data-test="fenetre"]');

test("Chronomètre et fenêtre 15ᵉ-20ᵉ : états, alertes (bandeau, vibration) et calage", async ({ page }) => {
  await ouvrirAvecHorloge(page);
  await page.getByRole("link", { name: "Suivre Lens – Brest en live" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Live +1.5" })).toBeVisible();
  await expect(page.locator("#live-match")).toHaveValue(LENS.id);
  await expect(page.locator('[data-test="live-lambda"]')).toContainText("Buts attendus : 3,15");
  await expect(etatFenetre(page)).toHaveAttribute("data-etat", "non-lance");

  await page.getByRole("button", { name: "Coup d'envoi" }).click();
  await expect(minute(page)).toHaveText("0′");
  await expect(etatFenetre(page)).toHaveAttribute("data-etat", "trop-tot");
  await expect(etatFenetre(page)).toContainText("dans 15 min");

  await page.clock.fastForward(11 * MINUTE + 30_000);
  await expect(minute(page)).toHaveText("11′");
  await expect(page.locator('[data-test="chrono-temps"]')).toHaveText("11:30");
  await expect(etatFenetre(page)).toHaveAttribute("data-etat", "trop-tot");

  await page.clock.fastForward(30_000);
  await expect(etatFenetre(page)).toHaveAttribute("data-etat", "bientot");
  await expect(page.locator('[data-test="toast"]')).toContainText("Prépare-toi");

  await page.clock.fastForward(3 * MINUTE);
  await expect(minute(page)).toHaveText("15′");
  await expect(etatFenetre(page)).toHaveAttribute("data-etat", "ouverte");
  await expect(etatFenetre(page)).toContainText("encore 6 min");
  await expect(page.locator('[data-test="toast"]')).toContainText("Fenêtre ouverte");
  await page.clock.fastForward(4 * MINUTE + 59_000);
  await expect(minute(page)).toHaveText("19′");
  await expect(etatFenetre(page)).toContainText("encore 1 min");

  await page.clock.fastForward(MINUTE + 1000);
  await expect(minute(page)).toHaveText("21′");
  await expect(etatFenetre(page)).toHaveAttribute("data-etat", "passee");
  await expect(page.locator('[data-test="toast"]')).toContainText("Fenêtre passée");
  const vibrations = await page.evaluate(() => (window as unknown as { __vibrations: unknown[] }).__vibrations);
  expect(vibrations).toEqual([[150], [250, 100, 250], [400]]);

  // Calage sur la minute du match, +1 / −1 min
  await page.getByText("Caler ou arrêter le chronomètre").click();
  await page.fill("#live-regler", "17");
  await page.getByRole("button", { name: "Caler" }).click();
  await expect(minute(page)).toHaveText("17′");
  await expect(page.locator('[data-test="chrono-temps"]')).toHaveText("17:00");
  await page.getByRole("button", { name: "+1 min" }).click();
  await expect(minute(page)).toHaveText("18′");
  await page.getByRole("button", { name: "−1 min" }).click();
  await page.getByRole("button", { name: "−1 min" }).click();
  await expect(minute(page)).toHaveText("16′");
});

test("J'entre ? : verdicts selon la cote, le score, le match animé et la minute ; cote minimale du tableau", async ({ page }) => {
  await ouvrirAvecHorloge(page);
  await page.goto("/#/live?match=" + LENS.id);
  await page.getByRole("button", { name: "Coup d'envoi" }).click();
  const decision = page.locator('[data-test="decision-live"]');

  // Trop tôt (minute 5) : même avec une bonne cote
  await page.clock.fastForward(5 * MINUTE);
  await page.getByRole("button", { name: "Animé" }).click();
  await page.fill("#live-cote", "3,00");
  await expect(decision).toContainText("Un peu tôt");

  await page.clock.fastForward(11 * MINUTE);
  await expect(minute(page)).toHaveText("16′");
  await expect(decision).toHaveAttribute("data-verdict", "ok");
  await expect(decision).toContainText("Oui, tu peux parier");
  await expect(decision).toContainText("Mise conseillée : 4,00 €"); // 2 % de 200 €

  // Cote basse : sous la cote juste
  await page.fill("#live-cote", "1,20");
  await expect(decision).toContainText("Pas encore");
  await expect(decision).toContainText(/Attends que la cote monte à \d,\d\d ou plus\./);

  // Entre la cote juste et la cote minimale : la moitié de la mise
  const juste = Number((await page.locator('[data-test="chiffres-live"] .fait').nth(1).locator("b").textContent())!.split("·")[0].trim().replace(",", "."));
  const mini = Number((await page.locator('[data-test="chiffres-live"] .fait').nth(1).locator("b").textContent())!.split("·")[1].trim().replace(",", "."));
  expect(mini).toBeGreaterThan(juste);
  await page.fill("#live-cote", (Math.round(((juste + mini) / 2) * 100) / 100).toFixed(2).replace(".", ","));
  await expect(decision).toContainText("Oui, mais mise la moitié");
  await expect(decision).toContainText("Mise conseillée : 2,00 €");

  // Un but déjà marqué, ou un match fermé
  await page.fill("#live-cote", "3,00");
  await page.getByRole("button", { name: "Un but marqué" }).click();
  await expect(decision).toContainText("Un but est déjà marqué : la méthode ne marche qu'à 0-0.");
  await page.getByRole("button", { name: "0-0", exact: true }).click();
  await page.getByRole("button", { name: "Fermé" }).click();
  await expect(decision).toContainText("Patience");

  // Le graphique « maintenant ou plus tard ? » : chances à la minute actuelle dans l'infobulle
  await expect(page.locator('[data-test="graphique-chances"]')).toBeVisible();
  await expect(page.locator('[data-test="gc-infobulle"]')).toContainText("Effleure la courbe");

  // Le tableau replié : la cote minimale monte avec la minute, la ligne actuelle est marquée
  await page.locator('[data-test="graphique-chances"] details.repli > summary').click();
  const lignes = page.locator('[data-test="tableau-live"] tbody tr');
  await expect(lignes).toHaveCount(6);
  const minis: number[] = [];
  for (let i = 0; i < 6; i++) minis.push(Number((await lignes.nth(i).locator('[data-test="tab-cote-mini"]').textContent())!.replace(",", ".")));
  expect([...minis].sort((a, b) => a - b)).toEqual(minis);
  await expect(page.locator('[data-test="tableau-live"] tr.actuelle')).toHaveCount(1);
  await expect(page.locator('[data-test="tableau-live"] tr.actuelle th')).toHaveText("15ᵉ");

  // Sans cote saisie : rien n'est inventé, pas de pari possible
  await page.fill("#live-cote", "");
  await expect(decision).toContainText("Saisis la cote");
  await expect(page.getByRole("button", { name: "J'ai parié" })).toBeDisabled();
  // Les boutons − et + de la cote
  await page.getByRole("button", { name: "Augmenter : Cote « plus de 1,5 but »" }).click();
  await expect(page.locator("#live-cote")).toHaveValue("1,75");
  await page.getByRole("button", { name: "Diminuer : Cote « plus de 1,5 but »" }).click();
  await page.getByRole("button", { name: "Diminuer : Cote « plus de 1,5 but »" }).click();
  await expect(page.locator("#live-cote")).toHaveValue("1,65");
});

/** Pari de 20 € à 1,72 pris à la 18ᵉ minute, puis un but à la 25ᵉ. */
async function jusquAuBut(page: Page) {
  await ouvrirAvecHorloge(page);
  await page.goto("/#/live?match=" + LENS.id);
  await page.getByRole("button", { name: "Coup d'envoi" }).click();
  await page.clock.fastForward(18 * MINUTE);
  await page.fill("#live-cote", "1,72");
  await page.fill("#live-mise", "20");
  await page.getByRole("button", { name: "J'ai parié" }).click();
  const enJeu = page.locator('[data-test="en-jeu"]');
  await expect(enJeu).toContainText("20,00 € · 1,72");
  await expect(enJeu).toContainText("18ᵉ minute");
  await expect(enJeu).toContainText("+14,40 €");
  // 1,72 / 0,72 = 2,39 : cote « moins de 1,5 » à partir de laquelle couvrir rapporte
  await expect(page.locator('[data-test="seuil-avance"]')).toContainText("2,39");
  await page.clock.fastForward(7 * MINUTE);
  await page.getByRole("button", { name: "BUT !" }).click();
  await expect(page.getByRole("heading", { name: "But à la 25ᵉ minute : couvrir ?" })).toBeVisible();
}

test("BUT ! puis pari contraire : exemple du carnet (20 € à 1,72, contraire à 2,60), scénarios avec et sans couverture", async ({ page }) => {
  await jusquAuBut(page);
  await expect(page.locator('[data-test="couverture-a-saisir"]')).toContainText("Tape la cote « moins de 1,5 but »");
  await page.fill("#live-contre", "2,60");
  const r = page.locator('[data-test="reponse-couverture"]');
  await expect(r).toHaveAttribute("data-rentable", "true");
  await expect(r).toContainText("Mise 13,23 € sur « moins de 1,5 but »");
  await expect(r).toContainText("Tu gagnes 1,17 € quel que soit le score final.");
  await expect(page.locator('[data-test="sc-but-sans"]')).toHaveText("+14,40 €");
  await expect(page.locator('[data-test="sc-pas-but-sans"]')).toHaveText("−20,00 €");
  await expect(page.locator('[data-test="sc-but-avec"]')).toHaveText("+1,17 €");
  await expect(page.locator('[data-test="sc-pas-but-avec"]')).toHaveText("+1,17 €");
  await expect(page.locator('[data-test="sc-esperance-avec"]')).toHaveText("+1,17 €");
  await expect(page.locator('[data-test="sc-esperance-sans"]')).toHaveText(/^[+−]\d+,\d\d €$/);
  await expect(page.locator('[data-test="chances-but"]')).toContainText(/Chances d'un 2ᵉ but avant la fin : \d+ %/);

  // Cote trop basse : couvrir coûterait de l'argent, et le texte n'invente pas qu'attendre aide
  await page.fill("#live-contre", "2,20");
  await expect(r).toHaveAttribute("data-rentable", "false");
  await expect(r).toContainText("Pas rentable maintenant");
  await expect(r).toContainText("Couvrir te ferait perdre 1,24 €");
  await expect(r).toContainText("d'au moins 2,39");
  await expect(r).toContainText("attendre ne l'améliore pas");
  await expect(page.locator('[data-test="sc-but-avec"]')).toHaveText("−1,24 €");
});

test("Couverture par exchange (lay) et cash-out ; but annulé (VAR) ; terminer le live", async ({ page }) => {
  await jusquAuBut(page);
  const r = page.locator('[data-test="reponse-couverture"]');

  await page.getByRole("button", { name: "Exchange (lay)" }).click();
  await page.fill("#live-lay", "1,50");
  await expect(r).toContainText("Lay de 23,72 €");
  await expect(r).toContainText("Tu gagnes au moins 2,54 €");
  await expect(r).toContainText("Il faut 11,86 € sur ton compte exchange.");
  await expect(page.locator('[data-test="sc-but-avec"]')).toHaveText("+2,54 €");
  await expect(page.locator('[data-test="sc-pas-but-avec"]')).toHaveText("+2,54 €");
  await page.fill("#live-lay", "1,80");
  await expect(r).toContainText("Pas rentable");
  await expect(r).toContainText("il faut au plus 1,68");

  await page.getByRole("button", { name: "Cash-out" }).click();
  await page.fill("#live-cash", "26");
  await expect(r).toContainText("Tu gagnes 6,00 €");
  await page.fill("#live-cash", "14,5");
  await expect(r).toContainText("Tu perds 5,50 €");
  await expect(r).toContainText("Ce cash-out est inférieur à ta mise.");
  await expect(page.locator('[data-test="sc-but-avec"]')).toHaveText("−5,50 €");
  await expect(page.locator('[data-test="sc-pas-but-avec"]')).toHaveText("−5,50 €");

  // But annulé : retour au pari en cours
  await page.getByRole("button", { name: "But annulé (VAR)" }).click();
  await expect(page.locator('[data-test="en-jeu"]')).toBeVisible();
  await expect(page.locator('[data-test="couverture"]')).toHaveCount(0);

  // Terminer : confirmation, puis écran de départ
  await page.getByRole("button", { name: "Terminer le live" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Terminer" }).click();
  await expect(page.locator('[data-test="entree"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Coup d'envoi" })).toBeVisible();
});

test("Le live survit à la fermeture de l'app ; un autre match demandé pendant un live demande confirmation", async ({ page }) => {
  await importerLens(page);
  // Un 2ᵉ match, chargé par la même voie
  const metz = { ...LENS, id: `${DATE}-metz-lille`, heure: "18:00", domicile: equipe("Metz"), exterieur: equipe("Lille") };
  await importer(page, [metz]);
  await page.goto("/#/live?match=" + LENS.id);
  await page.getByRole("button", { name: "Coup d'envoi" }).click();
  await page.fill("#live-cote", "1,90");
  await page.fill("#live-mise", "12,5");
  await page.getByRole("button", { name: "J'ai parié" }).click();
  await expect(page.locator('[data-test="en-jeu"]')).toContainText("12,50 € · 1,90");
  await page.getByRole("button", { name: "BUT !" }).click();
  await page.fill("#live-contre", "2,50");
  await page.getByRole("button", { name: "Pari contraire" }).click();

  await page.reload();
  await expect(page.locator('[data-test="couverture"]')).toBeVisible();
  await expect(page.locator("#live-match")).toHaveValue(LENS.id);
  await expect(minute(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^But à la \d+ᵉ minute : couvrir \?$/ })).toBeVisible();

  // Un autre match demandé pendant un live (depuis la liste des matchs) : rien n'est effacé sans accord
  await page.goto("/#/matchs");
  await page.getByRole("link", { name: "Suivre Metz – Lille en live" }).click();
  await expect(page.getByText("Un live est déjà en cours. Tu as demandé un autre match.")).toBeVisible();
  await page.getByRole("button", { name: "Garder le live en cours" }).click();
  await expect(page.locator('[data-test="couverture"]')).toBeVisible();
  await expect(page.locator("#live-match")).toHaveValue(LENS.id);
  // L'adresse est nettoyée : recharger ne redemande rien
  await page.reload();
  await expect(page.getByText("Un live est déjà en cours. Tu as demandé un autre match.")).toHaveCount(0);
  await expect(page.locator('[data-test="couverture"]')).toBeVisible();

  // Même demande, cette fois acceptée : le live repart de zéro sur l'autre match
  await page.goto("/#/matchs");
  await page.getByRole("link", { name: "Suivre Metz – Lille en live" }).click();
  await page.getByRole("button", { name: "Passer à ce match (efface le live en cours)" }).click();
  await expect(page.locator("#live-match")).toHaveValue(metz.id);
  await expect(page.locator('[data-test="entree"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Coup d'envoi" })).toBeVisible();

  // Un match inconnu dans l'adresse est ignoré
  await page.goto("/#/matchs");
  await page.goto("/#/live?match=n-existe-pas");
  await expect(page.locator("#live-match")).toHaveValue(metz.id);
  await expect(page.getByText("Un live est déjà en cours")).toHaveCount(0);
});

test("Sans match : buts attendus saisis à la main, cote minimale calculée", async ({ page }) => {
  await page.goto("/#/live");
  await expect(page.locator("#live-match")).toHaveValue("");
  await page.fill("#live-lambda", "2,7");
  await page.fill("#live-minute-manuelle", "20");
  await page.getByRole("button", { name: "Animé" }).click();
  await page.fill("#live-cote", "3,00");
  await expect(page.locator('[data-test="decision-live"]')).toHaveAttribute("data-verdict", "ok");
  await expect(page.locator('[data-test="graphique-chances"]')).toBeVisible();
  await page.locator('[data-test="graphique-chances"] details.repli > summary').click();
  await expect(page.locator('[data-test="tableau-live"] tbody tr')).toHaveCount(6);
  await expect(page.locator('[data-test="live-lambda"]')).toHaveCount(0);
});
