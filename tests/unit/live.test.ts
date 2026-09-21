/**
 * Live +1.5 (phase 4) : fenêtre, décision d'entrée, couverture et scénarios, cas calculés à la main.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluerPlus15, type Evaluation } from "../../src/core/carnet-v1/criteres";
import { couvrir, chancesDeuxiemeBut, chancesLive, decisionLive, fenetre, tableauLive, type EntreeLive } from "../../src/core/modele-v2/live";
import { lambdaRestantA00, lambdaRestantApres, partJouee } from "../../src/core/modele-v2/temps";
import { pPlusDe } from "../../src/core/poisson";
import { empreinte, REGLAGES_LOCAUX } from "../../src/data/contenu";
import { completerEtatLive, ETAT_LIVE_VIDE, tempsEcoule } from "../../src/data/live";
import { creerSauvegarde } from "../../src/data/sauvegarde";

const proche = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("Buts restants après N buts : 0 but = le calcul de la phase 3 ; un but relève, aucun but baisse", () => {
  proche(lambdaRestantApres(2.8, 0.56, 20, 0), lambdaRestantA00(2.8, 0.56, 20));
  // Sans incertitude : seul le temps compte, quel que soit le score
  proche(lambdaRestantApres(2.8, 0, 25, 1), 2.8 * (1 - partJouee(25)));
  // Avec incertitude : k = (2,8 / 0,56)² = 25 ; après 1 but à la 25ᵉ : (26 × 2,8) / (25 + 2,8 × 0,235) × 0,765
  const joue = partJouee(25);
  proche(lambdaRestantApres(2.8, 0.56, 25, 1), ((26 * 2.8) / (25 + 2.8 * joue)) * (1 - joue));
  assert.ok(lambdaRestantApres(2.8, 0.56, 25, 1) > lambdaRestantApres(2.8, 0.56, 25, 0));
  assert.ok(Number.isNaN(lambdaRestantApres(0, 0.5, 20, 0)));
});

test("Fenêtre 15ᵉ-20ᵉ minute : chaque état et ses bornes", () => {
  assert.equal(fenetre(null).etat, "non-lance");
  assert.equal(fenetre(0).etat, "trop-tot");
  assert.equal(fenetre(11).etat, "trop-tot");
  assert.equal(fenetre(12).etat, "bientot");
  assert.equal(fenetre(14).etat, "bientot");
  assert.equal(fenetre(15).etat, "ouverte");
  assert.equal(fenetre(20, 59).etat, "ouverte");
  assert.equal(fenetre(21).etat, "passee");
  assert.equal(fenetre(30).etat, "passee");
  assert.equal(fenetre(31).etat, "tard");
  assert.match(fenetre(15, 0).detail, /encore 6 min/);
  assert.match(fenetre(18, 30).detail, /encore 2 min/);
  assert.match(fenetre(12).detail, /dans 3 min/);
});

const base: EntreeLive = { lambda: 2.8, sigma: 0.56, minute: 20, cote: 2.5, scoreNul: true, anime: true, evaluation: null, miseBase: 10 };

test("Chances live : fourchette et cotes juste / minimale", () => {
  const c = chancesLive(2.8, 0.56, 20);
  proche(c.p, pPlusDe(lambdaRestantA00(2.8, 0.56, 20), 1.5));
  proche(c.pBas, pPlusDe(lambdaRestantA00(2.24, 0.56, 20), 1.5));
  proche(c.pHaut, pPlusDe(lambdaRestantA00(3.36, 0.56, 20), 1.5));
  assert.ok(c.pBas < c.p && c.p < c.pHaut);
  proche(c.coteJuste, 1 / c.p);
  proche(c.coteMinimale, 1 / c.pBas);
  // Plus la minute avance à 0-0, plus la cote minimale monte
  const t = tableauLive(2.8, 0.56);
  assert.deepEqual(t.map((x) => x.minute), [15, 20, 25, 30, 35, 40]);
  for (let i = 1; i < t.length; i++) assert.ok(t[i].coteMinimale > t[i - 1].coteMinimale && t[i].coteJuste > t[i - 1].coteJuste);
});

test("Décision d'entrée : règles du carnet dans le même ordre, avec le nouveau modèle", () => {
  const c = chancesLive(2.8, 0.56, 20);
  const evalKo: Evaluation = { c: [], v: "ko", why: "Non : x." };
  // 1. Un but déjà marqué
  const d1 = decisionLive({ ...base, scoreNul: false });
  assert.deepEqual([d1.v, d1.titre, d1.pourquoi], ["ko", "Non", "Un but est déjà marqué : la méthode ne marche qu'à 0-0."]);
  // 2. Critères du match non remplis
  assert.equal(decisionLive({ ...base, evaluation: evalKo }).v, "ko");
  // 3. Cote sous la cote juste
  const d3 = decisionLive({ ...base, cote: Math.floor(c.coteJuste * 100 - 1) / 100 });
  assert.equal(d3.titre, "Pas encore");
  assert.match(d3.pourquoi, /^Attends que la cote monte à \d,\d\d ou plus\.$/);
  assert.ok(d3.value <= 0 && d3.mise === null);
  // 4. Match fermé
  assert.equal(decisionLive({ ...base, anime: false }).titre, "Patience");
  // 5. Trop tôt
  const tot = chancesLive(2.8, 0.56, 8);
  assert.equal(decisionLive({ ...base, minute: 8, cote: tot.coteMinimale + 1 }).titre, "Un peu tôt");
  // 6. Entre cote juste et cote minimale : la moitié de la mise
  const milieu = decisionLive({ ...base, cote: Math.round(((c.coteJuste + c.coteMinimale) / 2) * 100) / 100 });
  assert.equal(milieu.titre, "Oui, mais mise la moitié");
  assert.equal(milieu.v, "mid");
  assert.equal(milieu.mise, 5);
  assert.match(milieu.pourquoi, /marge d'erreur du modèle/);
  // 7. Cote minimale atteinte : on joue
  const bonne = decisionLive({ ...base, cote: Math.ceil(c.coteMinimale * 100 + 1) / 100 });
  assert.equal(bonne.v, "ok");
  assert.equal(bonne.titre, "Oui, tu peux parier");
  assert.equal(bonne.mise, 10);
  proche(bonne.value, (Math.ceil(c.coteMinimale * 100 + 1) / 100) * c.p - 1);
  // Cote non saisie ou impossible : jamais de verdict
  assert.equal(decisionLive({ ...base, cote: NaN }).titre, "Saisis la cote");
  assert.equal(decisionLive({ ...base, cote: 1 }).titre, "Saisis la cote");
  // Sans buts attendus
  assert.equal(decisionLive({ ...base, lambda: NaN }).titre, "Il manque des infos");
  // Un match qui remplit les critères ne bloque pas
  const ok = evaluerPlus15({
    id: "x",
    domicile: { nom: "A", joues: 10, marques: 16, encaisses: 14, pctOver15: 80 },
    exterieur: { nom: "B", joues: 10, marques: 15, encaisses: 16, pctOver15: 80 },
  });
  assert.equal(decisionLive({ ...base, cote: 5, evaluation: ok }).v, "ok");
});

test("Pari contraire : exemple du carnet (20 € à 1,72, contraire à 2,60) et seuil de rentabilité", () => {
  const r = couvrir({ mode: "contre", mise: 20, cote: 1.72, coteContraire: 2.6, coteLay: null, commission: 5, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 });
  assert.ok(r.calculable);
  proche(r.miseCouverture!, 13.2307692, 1e-6);
  assert.equal(r.siBut.toFixed(2), "1.17");
  proche(r.siBut, r.siPasDeBut);
  assert.ok(r.rentable);
  // Rentable dès que « moins de 1,5 » ≥ O / (O − 1) = 1,72 / 0,72 = 2,3889
  assert.deepEqual(r.seuil, { type: "min", cote: 1.72 / 0.72 });
  const juste = couvrir({ mode: "contre", mise: 20, cote: 1.72, coteContraire: 1.72 / 0.72, coteLay: null, commission: 5, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 });
  proche(juste.garanti, 0, 1e-9);
  const perte = couvrir({ mode: "contre", mise: 20, cote: 1.72, coteContraire: 1.9, coteLay: null, commission: 5, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 });
  assert.ok(!perte.rentable && perte.garanti < 0);
  // Sans couvrir
  proche(r.sansCouvrir.siBut, 14.4);
  proche(r.sansCouvrir.siPasDeBut, -20);
});

test("Espérance sans couvrir : 1 − e^(−buts restants) chances d'un 2ᵉ but", () => {
  const rest = lambdaRestantApres(2.8, 0.56, 25, 1);
  proche(chancesDeuxiemeBut(2.8, 0.56, 25), 1 - Math.exp(-rest));
  assert.ok(chancesDeuxiemeBut(2.8, 0.56, 25) > chancesDeuxiemeBut(2.8, 0.56, 70), "moins de temps : moins de chances");
  const r = couvrir({ mode: "contre", mise: 20, cote: 1.72, coteContraire: 2.6, coteLay: null, commission: 5, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 });
  const p = chancesDeuxiemeBut(2.8, 0.56, 25);
  proche(r.pBut, p);
  proche(r.sansCouvrir.esperance, p * 14.4 - (1 - p) * 20);
});

test("Lay : mêmes résultats dans les deux cas, seuil maximum, responsabilité", () => {
  const r = couvrir({ mode: "lay", mise: 20, cote: 1.72, coteContraire: null, coteLay: 1.8, commission: 5, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 });
  assert.ok(r.calculable);
  proche(r.miseCouverture!, 19.6571429, 1e-6);
  proche(r.siBut, r.siPasDeBut, 1e-9);
  proche(r.responsabilite!, r.miseCouverture! * 0.8, 1e-9);
  assert.deepEqual(r.seuil, { type: "max", cote: 1.72 * 0.95 + 0.05 });
  // Cote lay trop haute : perte
  assert.ok(!couvrir({ mode: "lay", mise: 20, cote: 1.72, coteContraire: null, coteLay: 2.2, commission: 5, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 }).rentable);
  // Saisies impossibles
  assert.equal(couvrir({ mode: "lay", mise: 20, cote: 1.72, coteContraire: null, coteLay: 1, commission: 5, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 }).calculable, false);
  assert.equal(couvrir({ mode: "lay", mise: 20, cote: 1.72, coteContraire: null, coteLay: 1.8, commission: 100, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 }).calculable, false);
});

test("Cash-out : bénéfice = montant − mise, identique dans les deux cas", () => {
  const e = { mode: "cash" as const, mise: 20, cote: 1.72, coteContraire: null, coteLay: null, commission: 5, lambda: 2.8, sigma: 0.56, minuteBut: 25 };
  const gagne = couvrir({ ...e, cashOut: 26 });
  assert.deepEqual([gagne.siBut, gagne.siPasDeBut, gagne.rentable, gagne.seuil], [6, 6, true, null]);
  const perd = couvrir({ ...e, cashOut: 14.5 });
  assert.deepEqual([perd.garanti, perd.rentable], [-5.5, false]);
  assert.equal(couvrir({ ...e, cashOut: null }).calculable, false);
  assert.equal(couvrir({ ...e, cashOut: -3 }).calculable, false);
});

test("État du live : chronomètre par heure de coup d'envoi, valeurs fausses remplacées, pas de pari sans cote", () => {
  const debut = 1_700_000_000_000;
  assert.equal(tempsEcoule(null, debut), null);
  assert.deepEqual(tempsEcoule(debut, debut + 17 * 60000 + 42000), { minute: 17, secondes: 42 });
  assert.deepEqual(tempsEcoule(debut, debut - 5000), { minute: 0, secondes: 0 }, "horloge en arrière : jamais négatif");
  // Un écran éteint 30 minutes ne fausse rien : la minute est recalculée depuis le coup d'envoi
  assert.equal(tempsEcoule(debut, debut + 47 * 60000)!.minute, 47);

  assert.deepEqual(completerEtatLive(undefined), ETAT_LIVE_VIDE);
  assert.deepEqual(completerEtatLive("n'importe quoi"), ETAT_LIVE_VIDE);
  const e = completerEtatLive({ phase: "en-jeu", cote: 1.72, mise: 20, minuteEntree: 18, modeCouverture: "lay", commission: 99, minuteManuelle: -4, coupEnvoiLe: "x" });
  assert.deepEqual([e.phase, e.cote, e.mise, e.modeCouverture, e.commission, e.minuteManuelle, e.coupEnvoiLe], ["en-jeu", 1.72, 20, "lay", 30, 0, null]);
  // Pari en jeu sans cote : retour au départ ; but sans minute : retour à « en jeu »
  assert.equal(completerEtatLive({ phase: "en-jeu", mise: 20 }).phase, "avant");
  assert.equal(completerEtatLive({ phase: "but", cote: 1.7, mise: 10 }).phase, "en-jeu");
  assert.equal(completerEtatLive({ phase: "but", cote: 1.7, mise: 10, minuteBut: 25 }).phase, "but");
});

test("Le live est un réglage de l'appareil : absent de la sauvegarde, intact après une restauration", async () => {
  assert.ok(REGLAGES_LOCAUX.includes("live"));
  const contenu = { matchs: [], paris: [], reglages: [{ cle: "live", valeur: { phase: "en-jeu" } }, { cle: "theme", valeur: "sombre" }] };
  const f = await creerSauvegarde(contenu, "0.4.0", new Date("2026-09-22T10:00:00Z"));
  assert.deepEqual(f.contenu.reglages.map((r) => r.cle), ["theme"]);
  assert.equal(await empreinte(contenu), await empreinte({ ...contenu, reglages: [{ cle: "theme", valeur: "sombre" }] }));
});

test("Entrées invalides : jamais de chiffre inventé", () => {
  const r = couvrir({ mode: "contre", mise: 0, cote: 1.72, coteContraire: 2.6, coteLay: null, commission: 5, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 });
  assert.equal(r.calculable, false);
  assert.ok(Number.isNaN(r.garanti));
  assert.equal(couvrir({ mode: "contre", mise: 20, cote: 1, coteContraire: 2.6, coteLay: null, commission: 5, cashOut: null, lambda: 2.8, sigma: 0.56, minuteBut: 25 }).calculable, false);
});
