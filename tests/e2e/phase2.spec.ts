/**
 * Phase 2 de bout en bout : demande à l'autre conversation Claude, import de sa réponse
 * (aperçu, suite, doublons, compléments), fiabilité, suivi des cotes et alerte,
 * historiques CSV, et mise à niveau d'une base de la version 0.1.0 sans perte.
 */
import { expect, test, type Page } from "playwright/test";

const DATE = "2030-05-04";

function equipe(nom: string, pctOver15: number | null = 83) {
  return { nom, joues: 6, marques: 11, encaisses: 7, pctOver15, pctOver25: 67, derniersButsMarques: [2, 1, 3, 2] };
}

function match(dom: string, ext: string, extra: Record<string, unknown> = {}) {
  return {
    id: `${DATE}-${dom.toLowerCase()}-${ext.toLowerCase()}`,
    date: DATE,
    heure: "21:00",
    ligue: "Ligue 1",
    selection: false,
    feminin: false,
    moyenneButsLigue: 2.85,
    domicile: equipe(dom),
    exterieur: equipe(ext),
    h2h: { joues: 6, over25: 4 },
    contexte: "normal",
    absents: [],
    absenceOffensive: false,
    meilleurButeurAbsent: false,
    defenseAffaiblie: false,
    cotes: null,
    manquants: [],
    ...extra,
  };
}

const reponse = (matchs: unknown[], suite = false) =>
  "Voici les matchs :\n```json\n" + JSON.stringify({ matchs }, null, 1) + "\n```\n" + (suite ? "SUITE DISPONIBLE — écris « continue »" : "");

const carte = (page: Page, equipe: string) => page.locator("article.match", { hasText: equipe });

async function coller(page: Page, texte: string) {
  await page.fill("#reponse-claude", texte);
  await page.locator('[data-test="apercu-matchs"]').waitFor();
}

test("Demande : jour, compétitions, nombre de matchs, saison d'après la date ; réglages gardés", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:4173" });
  await page.goto("/#/matchs");
  const rec = page.locator('[data-test="recuperer"]');
  await expect(rec).toHaveAttribute("open", "");
  await page.fill("#demande-date", "2027-03-10");
  await expect(rec).toContainText("Saison des statistiques : 2026-2027.");
  await rec.getByText("WSL", { exact: true }).click();
  await page.selectOption("#demande-par-reponse", "6");
  await page.selectOption("#demande-max", "10");
  await rec.getByText("Voir le texte de la demande").click();
  const texte = page.locator('[data-test="texte-demande"]');
  await expect(texte).toContainText("Women's Super League (Angleterre, féminin)");
  await expect(texte).toContainText("S'il y a plus de 6 matchs, donne les 6 premiers");
  await expect(texte).toContainText("Garde au plus 10 matchs au total");
  await expect(texte).toContainText("mercredi 10 mars 2027 (date 2027-03-10)");
  await expect(texte).toContainText("saison 2026-2027");
  await page.getByRole("button", { name: "Copier la demande" }).click();
  await expect(page.locator('[data-test="toast"]')).toContainText("Demande copiée");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('"under25"');

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "WSL" })).toBeChecked();
  await expect(page.locator("#demande-par-reponse")).toHaveValue("6");
  await expect(page.locator("#demande-max")).toHaveValue("10");
});

test("Réponse de Claude : aperçu, suite, compléments, doublons, fiabilité, suivi des cotes et alerte", async ({ context, page }) => {
  await context.grantPermissions(["notifications"], { origin: "http://localhost:4173" });
  await page.goto("/#/matchs");
  await page.evaluate(() => navigator.serviceWorker.ready);

  // 1re partie : un match complet avec cotes, un match incomplet ; la suite est annoncée
  const lens = match("Lens", "Brest", { cotes: { over15: 1.25, under15: 3.8, over25: 1.7, under25: 2.1, bookmaker: "Unibet" } });
  const metz = match("Metz", "Lille", { domicile: equipe("Metz", null), manquants: ["pctOver15"] });
  await coller(page, reponse([lens, metz], true));
  await expect(page.locator('[data-test="nb-nouveaux"]')).toHaveText("2");
  await page.getByRole("button", { name: "Enregistrer 2 nouveaux" }).click();
  await expect(page.locator('[data-test="resultat-matchs"]')).toContainText("2 matchs ajoutés, 0 complété.");
  await expect(page.locator('[data-test="suite-disponible"]')).toContainText("écris continue");
  await expect(page.locator('[data-test="complements"]')).toContainText("Metz – Lille : % de matchs à 2+ buts (Metz)");
  await expect(page.locator('[data-test="complements"]').getByRole("button", { name: "Copier la demande de compléments" })).toBeVisible();
  await expect(page.locator("article.match")).toHaveCount(2);

  // Fiabilité sur 8 et ce qui manque
  await expect(carte(page, "Metz").locator('[data-test="infos-sur-8"]')).toHaveText("6/8");
  await expect(carte(page, "Metz").locator('[data-test="manques"]')).toContainText("À compléter : % de matchs à 2+ buts (Metz) (une seule équipe renseignée)");
  await expect(carte(page, "Metz").locator('[data-test="manques"]')).toContainText("Publié plus tard : cotes");
  // Marge du bookmaker : 1/1,70 + 1/2,10 − 1 = 6,4 %
  await expect(carte(page, "Lens").locator(".match-bas")).toContainText("Marge du bookmaker 6,4 % (2,5 buts)");

  // Cote minimale choisie : 1,90 sur « plus de 2,5 buts » (la cote actuelle 1,70 ne l'atteint pas)
  const lensCarte = carte(page, "Lens");
  await lensCarte.getByText("Cotes et suivi").click();
  const idMin = `#m-${DATE}-lens-brest-min-over25`;
  await page.fill(idMin, "1,90");
  await page.locator(idMin).locator("xpath=ancestor::form").getByRole("button", { name: "Enregistrer" }).click();
  await expect(lensCarte.locator('[data-test="cote-min-over25"]')).toHaveText("1,90 (choisie par toi)");
  await expect(lensCarte.locator('[data-test="alerte-cote"]')).toHaveCount(0);

  // 2e partie : la cote de Lens monte à 1,95, Metz est complété, un nouveau match en double
  const psg = match("PSG", "OM");
  await coller(
    page,
    reponse([
      { id: lens.id, date: DATE, domicile: { nom: "Lens" }, exterieur: { nom: "Brest" }, cotes: { over25: 1.95, under25: 1.85 } },
      { id: metz.id, date: DATE, domicile: { nom: "Metz", pctOver15: 75 }, exterieur: { nom: "Lille" } },
      psg,
      { ...psg, id: undefined, absents: ["OM : Joueur (blessé)"] },
    ]),
  );
  const apercu = page.locator('[data-test="apercu-matchs"]');
  await expect(apercu.locator('[data-test="nb-nouveaux"]')).toHaveText("1");
  await expect(apercu.locator('[data-test="nb-mis-a-jour"]')).toHaveText("2");
  await expect(apercu).toContainText("PSG – OM apparaît deux fois dans la réponse");
  await expect(apercu).toContainText("cotes suivies");
  await page.getByRole("button", { name: "Enregistrer 1 nouveau et 2 complétés" }).click();
  await expect(page.locator('[data-test="resultat-matchs"]')).toContainText("1 match ajouté, 2 complétés.");
  await expect(page.locator("article.match")).toHaveCount(3);
  await expect(carte(page, "Metz").locator('[data-test="infos-sur-8"]')).toHaveText("7/8");

  // Alerte : sur la carte, dans le suivi, en notification, sur l'accueil
  await expect(lensCarte.locator('[data-test="alerte-cote"]')).toContainText("plus de 2,5 buts à 1,95, cote mini 1,90");
  await expect(lensCarte.locator('[data-test="historique-cotes"] li')).toHaveCount(2);
  await expect(lensCarte.locator('[data-test="historique-cotes"] li').first()).toContainText("+2,5 1,95");
  const notifs = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.body));
  expect(notifs).toContain("Lens – Brest : plus de 2,5 buts à 1,95 (cote mini choisie : 1,90)");
  await page.getByRole("button", { name: "Cote atteinte" }).click();
  await expect(page.locator("article.match")).toHaveCount(1);
  await page.goto("/#/accueil");
  await expect(page.locator('[data-test="alertes-accueil"]')).toContainText("Lens – Brest : plus de 2,5 buts à 1,95 (cote mini choisie : 1,90)");

  // Tout est gardé après rechargement
  await page.goto("/#/matchs");
  await page.reload();
  await expect(page.locator("article.match")).toHaveCount(3);
  await expect(carte(page, "PSG")).toBeVisible();
});

test("Cotes ressaisies à la main : contrôle de saisie, marge, nouveau relevé", async ({ page }) => {
  await page.goto("/#/matchs");
  await coller(page, reponse([match("Lens", "Brest", { cotes: { over15: 1.25, over25: 1.7, bookmaker: "Unibet" } })]));
  await page.getByRole("button", { name: "Enregistrer 1 nouveau" }).click();
  const c = carte(page, "Lens");
  await c.getByText("Cotes et suivi").click();
  await expect(c.locator('[data-test="marge"]')).toContainText("⏳");
  const base = `#m-${DATE}-lens-brest`;
  await page.fill(`${base}-over25`, "abc");
  await c.getByRole("button", { name: "Enregistrer ces cotes" }).click();
  await expect(c.getByRole("alert")).toContainText("Plus de 2,5 : tape une cote supérieure à 1");
  await page.fill(`${base}-over25`, "1,88");
  await page.fill(`${base}-under25`, "1,95");
  await page.fill(`${base}-bookmaker`, "Winamax");
  await c.getByRole("button", { name: "Enregistrer ces cotes" }).click();
  // 1,88 atteint la cote mini calculée par le carnet (1,73) : l'alerte suit l'enregistrement
  await expect(page.locator('[data-test="toast"]')).toHaveText("Cote atteinte : Lens – Brest : plus de 2,5 buts à 1,88 (cote mini calculée : 1,73)");
  await expect(c.locator('[data-test="alerte-cote"]')).toContainText("plus de 2,5 buts à 1,88, cote mini 1,73");
  // 1/1,88 + 1/1,95 − 1 = 4,5 %
  await expect(c.locator('[data-test="marge"]')).toHaveText("4,5 % (2,5 buts)");
  const releves = c.locator('[data-test="historique-cotes"] li');
  await expect(releves).toHaveCount(2);
  await expect(releves.first()).toContainText("saisie · Winamax");
  await expect(releves.first()).toContainText("+2,5 1,88");
  await expect(releves.first().getByLabel("en hausse")).toBeVisible();
  await expect(releves.first()).toContainText("+1,5 1,25", { useInnerText: true });
});

const E0 =
  "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,Avg>2.5,Avg<2.5\n" +
  "E0,15/08/2025,20:00,Liverpool,Bournemouth,4,2,H,1,0,H,1.39,3.02\n" +
  "E0,16/08/2025,12:30,Aston Villa,Newcastle,0,0,D,0,0,D,1.82,1.99\n" +
  "E0,16/08/2025,15:00,Brighton,Fulham,1,1,D,0,1,A,1.75,2.10\n" +
  "E0,24/05/2026,16:00,Arsenal,Chelsea,,,,,,,,\n";
const F1 =
  "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR\n" +
  "F1,15/08/2025,20:45,Rennes,Marseille,1,0,H,0,0,D\n" +
  "F1,16/08/2025,17:00,Lens,Lyon,0,1,A,0,0,D\n";

test("Historiques CSV : plusieurs fichiers, fichier refusé, doublons, suppression, gardés après rechargement", async ({ page }) => {
  await page.goto("/#/donnees");
  const fichiers = page.locator('[data-test="fichiers-csv"]');
  await fichiers.setInputFiles([
    { name: "E0.csv", mimeType: "text/csv", buffer: Buffer.from(E0) },
    { name: "F1.csv", mimeType: "text/csv", buffer: Buffer.from(F1) },
    { name: "notes.csv", mimeType: "text/csv", buffer: Buffer.from("nom,prenom\nA,B\n") },
  ]);
  const apercu = page.locator('[data-test="apercu-csv"]');
  await expect(apercu).toContainText("Premier League 2025-2026");
  await expect(apercu).toContainText("Pas encore joués (ignorés)");
  await expect(apercu.getByRole("alert")).toContainText("ne ressemble pas à un fichier de football-data.co.uk");
  await page.getByRole("button", { name: "Enregistrer 5 résultats" }).click();
  const enregistres = page.locator('[data-test="historiques-enregistres"]');
  await expect(enregistres).toContainText("Premier League 2025-2026");
  await expect(enregistres).toContainText("3 matchs, du ven. 15 août 2025 au sam. 16 août 2025");
  await expect(enregistres).toContainText("2,67 buts par match · 2+ buts 67 % · 3+ buts 33 %");
  await expect(enregistres).toContainText("Ligue 1 2025-2026");

  // Le même fichier une 2e fois : reconnu comme déjà enregistré
  await fichiers.setInputFiles([{ name: "E0.csv", mimeType: "text/csv", buffer: Buffer.from(E0) }]);
  await expect(apercu.locator('[data-test="csv-nouveaux"]')).toHaveText("0");
  await expect(apercu.locator('[data-test="csv-identiques"]')).toHaveText("3");

  await enregistres.getByRole("button", { name: "Supprimer Ligue 1 2025-2026" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(enregistres).not.toContainText("Ligue 1");
  await page.reload();
  await expect(page.locator('[data-test="historiques-enregistres"]')).toContainText("Premier League 2025-2026");
});

test("Mise à niveau : une base de la version 0.1.0 garde ses paris, matchs et réglages", async ({ page }) => {
  // Base créée comme par la version 0.1.0 (base de version 1), avant tout lancement de la nouvelle app
  await page.goto("/manifest.webmanifest");
  await page.evaluate(
    (date) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("carnet-paris-foot", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore("matchs", { keyPath: "id" });
          db.createObjectStore("paris", { keyPath: "id" }).createIndex("ordre", "ordre");
          db.createObjectStore("reglages", { keyPath: "cle" });
          db.createObjectStore("versions", { keyPath: "id" }).createIndex("creeLe", "creeLe");
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(["matchs", "paris", "reglages"], "readwrite");
          tx.objectStore("paris").put({ id: "p1", ordre: 0, date: "2026-09-01", match: "Lens – Brest", methode: "+2.5", cote: 1.8, mise: 10, statut: "gagne", creeLe: "", modifieLe: "" });
          tx.objectStore("reglages").put({ cle: "bankroll", valeur: { depart: 300, pctMise: 2 } });
          tx.objectStore("matchs").put({ id: "vieux", date, heure: "21:00", ligue: "Ligue 1", domicile: { nom: "Nantes" }, exterieur: { nom: "Nice" }, cotes: { over25: 1.9 } });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    DATE,
  );
  await page.goto("/#/paris");
  await expect(page.locator(".pari")).toHaveCount(1);
  await expect(page.locator('[data-test="bankroll-entete"]')).toHaveText("308,00 €");
  await page.goto("/#/matchs");
  await expect(carte(page, "Nantes")).toBeVisible();
  // Le vieux match se complète normalement ; ses anciennes cotes entrent dans le suivi
  await page.locator('[data-test="recuperer"] > summary').click();
  await coller(page, reponse([{ id: "vieux", date: DATE, domicile: { nom: "Nantes" }, exterieur: { nom: "Nice" }, cotes: { over25: 2.0 } }]));
  await page.getByRole("button", { name: "Enregistrer 1 complété" }).click();
  await carte(page, "Nantes").getByText("Cotes et suivi").click();
  const releves = carte(page, "Nantes").locator('[data-test="historique-cotes"] li');
  await expect(releves).toHaveCount(2);
  await expect(releves.last()).toContainText("avant le suivi");
  await page.goto("/#/donnees");
  await expect(page.locator("#titre-historiques")).toBeVisible();
  await expect(page.getByText("Aucun historique pour l'instant.")).toBeVisible();
});
