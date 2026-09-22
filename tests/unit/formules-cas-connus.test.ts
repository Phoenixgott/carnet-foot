/**
 * Formules vérifiées sur des cas connus, calculés à la main,
 * et sur des propriétés qui doivent toujours tenir (ex. : une couverture
 * donne le même résultat quelle que soit l'issue du match).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pAuPlus, pPlusDe, lambdaRestant } from "../../src/core/poisson";
import { couvertureLay, couverturePariContraire, resultatCashOut } from "../../src/core/couverture";
import { bilan, gainPari, miseConseillee } from "../../src/core/paris";
import { eur, fr, pc } from "../../src/core/format";
import type { Pari } from "../../src/core/types";

const proche = (a: number, b: number, tol = 1e-6, quoi = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${quoi} attendu ${b}, obtenu ${a}`);

test("Poisson : cas connus", () => {
  // λ = 2,5 : P(0) = e^-2,5 = 0,082085 ; P(1) = 0,205212 ; P(2) = 0,256516
  proche(pAuPlus(2.5, 0), 0.0820850, 1e-6, "P(0 but)");
  proche(pPlusDe(2.5, 1.5), 0.7127025, 1e-6, "P(+1.5)");
  proche(pPlusDe(2.5, 2.5), 0.4561869, 1e-6, "P(+2.5)");
  // λ = 1 : P(≥2) = 1 − 2/e
  proche(pPlusDe(1, 1.5), 1 - 2 / Math.E, 1e-12, "P(+1.5) λ=1");
  // λ = 0 : aucun but possible
  assert.equal(pPlusDe(0, 1.5), 0);
  // Les probabilités se somment à 1
  proche(pAuPlus(3.2, 60), 1, 1e-12, "somme");
});

test("Buts restants : modèle uniforme du carnet (90 min + 3 min d'arrêts)", () => {
  proche(lambdaRestant(2.7, 20), (2.7 * 73) / 90, 1e-12);
  assert.equal(lambdaRestant(2.7, 93), 0);
  assert.equal(lambdaRestant(2.7, 120), 0);
});

test("Couverture par pari contraire : exemple du carnet (20 € à 1,72, contraire à 2,60)", () => {
  const k = couverturePariContraire(20, 1.72, 2.6);
  proche(k.miseCouverture, 13.2307692, 1e-6, "mise de couverture");
  assert.equal(eur(k.profit), "1,17 €");
  // Même résultat dans les deux scénarios
  const siBut = 20 * (1.72 - 1) - k.miseCouverture;
  const siPasDeBut = k.miseCouverture * (2.6 - 1) - 20;
  proche(siBut, k.profit, 1e-9, "scénario but");
  proche(siPasDeBut, k.profit, 1e-9, "scénario pas de but");
});

test("Couverture par lay avec commission : les deux issues donnent le même résultat", () => {
  for (const [S, O, X, c] of [[20, 1.72, 1.8, 0.05], [50, 2.1, 1.4, 0.02], [10, 1.6, 1.25, 0]]) {
    const l = couvertureLay(S, O, X, c);
    proche(l.siBut, l.siPasDeBut, 1e-9, `lay ${S}/${O}/${X}/${c}`);
    proche(l.responsabilite, l.miseLay * (X - 1), 1e-9);
  }
  const l = couvertureLay(20, 1.72, 1.8, 0.05);
  proche(l.miseLay, 19.6571429, 1e-6, "mise lay");
});

test("Cash-out : bénéfice = montant proposé − mise", () => {
  assert.equal(resultatCashOut(20, 26), 6);
  assert.equal(resultatCashOut(20, 14.5), -5.5);
});

const pari = (p: Partial<Pari>): Pari => ({
  id: "x", ordre: 0, date: "2026-09-01", match: "A – B", methode: "+1.5", cote: 2, mise: 10,
  statut: "attente", creeLe: "", modifieLe: "", ...p,
});

test("Gains, ROI et taux de réussite : cas connu", () => {
  const paris = [
    pari({ methode: "+1.5", cote: 2, mise: 10, statut: "gagne" }),     // +10
    pari({ methode: "+2.5", cote: 1.9, mise: 10, statut: "perdu" }),   // −10
    pari({ methode: "Freebet", cote: 4.5, mise: 100, statut: "manuel", pnl: 5 }), // +5, mise hors ROI
    pari({ methode: "+2.5", mise: 7, statut: "attente" }),             // ignoré
    pari({ methode: "+1.5", mise: 7, statut: "rembourse" }),           // ignoré
  ];
  assert.equal(gainPari(paris[0]), 10);
  const b = bilan(paris, { depart: 200, pctMise: 2 });
  assert.equal(b.gains, 5);
  assert.equal(b.bankroll, 205);
  assert.equal(b.rentabilite, 5 / 20);
  assert.equal(b.tauxReussite, 2 / 3);
  assert.equal(b.nbTermines, 3);
  assert.deepEqual(b.parMethode, [
    { methode: "+1.5", gains: 10, nb: 1 },
    { methode: "Freebet", gains: 5, nb: 1 },
    { methode: "+2.5", gains: -10, nb: 1 },
  ]);
  assert.equal(miseConseillee(paris, { depart: 200, pctMise: 2 }), 4.1);
});

test("Bilan vide : pas de division par zéro affichée comme un chiffre", () => {
  const b = bilan([], { depart: 200, pctMise: 2 });
  assert.ok(Number.isNaN(b.rentabilite));
  assert.ok(Number.isNaN(b.tauxReussite));
  assert.equal(pc(b.rentabilite), "?");
});

test("Mise en forme française", () => {
  assert.equal(fr(1.726), "1,73");
  assert.equal(fr(NaN), "?");
  assert.equal(eur(-1234.5), "−1234,50 €");
  assert.equal(eur(Infinity), "—");
  assert.equal(pc(0.7127), "71 %");
});
