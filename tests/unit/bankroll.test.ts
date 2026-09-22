/**
 * Statistiques avancées de bankroll (phase 6) : courbe, drawdown, séries, ventilations.
 * Cas calculés à la main.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  courbeBankroll,
  drawdownMax,
  jourSemaine,
  parCompetition,
  parJourSemaine,
  parMethode,
  parTrancheCote,
  series,
  trancheDe,
} from "../../src/core/bankroll";
import type { Pari } from "../../src/core/types";

const proche = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
let n = 0;
const pari = (extra: Partial<Pari>): Pari => ({
  id: "p" + ++n,
  ordre: n,
  date: "2026-09-01",
  match: "A – B",
  methode: "+2.5",
  cote: 2,
  mise: 10,
  statut: "gagne",
  creeLe: "",
  modifieLe: "",
  ...extra,
});

test("Courbe de bankroll : point 0 = départ, un point par pari terminé, dans l'ordre du journal", () => {
  const paris = [
    pari({ ordre: 2, statut: "gagne", cote: 2, mise: 10 }), // +10
    pari({ ordre: 0, statut: "perdu", mise: 20 }), // -20
    pari({ ordre: 3, statut: "attente" }), // ignoré
    pari({ ordre: 1, statut: "manuel", pnl: 5 }), // +5
  ];
  const c = courbeBankroll(paris, { depart: 200, pctMise: 2 });
  assert.equal(c.length, 4); // départ + 3 terminés (attente exclu)
  assert.deepEqual(c.map((pt) => pt.bankroll), [200, 180, 185, 195]); // ordre 0 (-20), 1 (+5), 2 (+10)
  assert.equal(c[0].pariId, null);
});

test("Drawdown maximal : la plus grande baisse depuis un sommet", () => {
  // Bankroll : 200 → 220 (sommet) → 190 → 210 → 150 (creux) → 180
  const c = [200, 220, 190, 210, 150, 180].map((bankroll, n) => ({ n, pariId: "p" + n, date: "", bankroll }));
  const d = drawdownMax(c);
  proche(d.montant, 70); // 220 → 150
  proche(d.pct, 70 / 220);
  assert.equal(d.duSommet, 1);
  assert.equal(d.auCreux, 4);
  // Bankroll qui ne fait que monter : aucun drawdown
  const montee = [200, 210, 220].map((bankroll, n) => ({ n, pariId: null, date: "", bankroll }));
  assert.deepEqual(drawdownMax(montee), { montant: 0, pct: 0, duSommet: 0, auCreux: 0 });
});

test("Séries : victoires et défaites consécutives, dans l'ordre chronologique", () => {
  // V V D D D V (ordre 0..5)
  const paris = ["gagne", "gagne", "perdu", "perdu", "perdu", "gagne"].map((statut, ordre) =>
    pari({ ordre, statut: statut as Pari["statut"], cote: 2, mise: 10 }),
  );
  const s = series(paris);
  assert.deepEqual(s.actuelle, { type: "victoire", longueur: 1 });
  assert.equal(s.meilleureVictoires, 2);
  assert.equal(s.pireDefaites, 3);

  const finDefaite = [...paris.slice(0, 5)]; // V V D D D
  const s2 = series(finDefaite);
  assert.deepEqual(s2.actuelle, { type: "defaite", longueur: 3 });

  assert.deepEqual(series([]).actuelle, { type: "neutre", longueur: 0 });
});

test("Ventilation par méthode : gains, mise engagée (Freebet exclue), ROI, taux de réussite", () => {
  const paris = [
    pari({ methode: "+2.5", statut: "gagne", cote: 2, mise: 10 }), // +10
    pari({ methode: "+2.5", statut: "perdu", mise: 10 }), // -10
    pari({ methode: "Freebet", statut: "manuel", pnl: 8, mise: 100 }), // +8, mise hors ROI
    pari({ methode: "+1.5", statut: "attente" }), // exclu (pas terminé)
  ];
  const v = parMethode(paris);
  const p25 = v.find((x) => x.cle === "+2.5")!;
  assert.deepEqual([p25.nb, p25.gains, p25.mise], [2, 0, 20]);
  proche(p25.roi, 0);
  proche(p25.tauxReussite, 0.5);
  const fb = v.find((x) => x.cle === "Freebet")!;
  assert.deepEqual([fb.nb, fb.gains, fb.mise], [1, 8, 0]);
  assert.ok(Number.isNaN(fb.roi), "aucune mise engagée hors freebet : ROI inconnu");
  assert.ok(!v.some((x) => x.cle === "+1.5"), "aucun pari terminé pour +1.5 : pas de ligne");
});

test("Ventilation par compétition : compétition inconnue regroupée à part", () => {
  const paris = [
    pari({ ligue: "Ligue 1", statut: "gagne", cote: 2, mise: 10 }),
    pari({ ligue: "Ligue 1", statut: "gagne", cote: 2, mise: 10 }),
    pari({ ligue: null, statut: "perdu", mise: 5 }),
    pari({ statut: "perdu", mise: 5 }),
  ];
  const v = parCompetition(paris);
  assert.equal(v.find((x) => x.cle === "Ligue 1")!.nb, 2);
  const inconnue = v.find((x) => x.libelle === "Compétition inconnue")!;
  assert.equal(inconnue.nb, 2);
});

test("Jour de la semaine : calcul correct, ventilation dans l'ordre lundi → dimanche", () => {
  assert.equal(jourSemaine("2026-09-21"), "lundi");
  assert.equal(jourSemaine("2026-09-27"), "dimanche");
  assert.equal(jourSemaine("date invalide"), null);
  const paris = [
    pari({ date: "2026-09-27", statut: "gagne", cote: 2, mise: 10 }), // dimanche
    pari({ date: "2026-09-21", statut: "gagne", cote: 2, mise: 10 }), // lundi
    pari({ date: "bizarre", statut: "perdu", mise: 5 }),
  ];
  const v = parJourSemaine(paris);
  assert.deepEqual(v.map((x) => x.libelle), ["Lundi", "Dimanche", "Jour inconnu"]);
});

test("Tranches de cote : bornes et ventilation triée du plus bas au plus haut", () => {
  assert.equal(trancheDe(1.2)!.libelle, "moins de 1,5");
  assert.equal(trancheDe(1.5)!.libelle, "1,5 à 2");
  assert.equal(trancheDe(1.99)!.libelle, "1,5 à 2");
  assert.equal(trancheDe(2)!.libelle, "2 à 3");
  assert.equal(trancheDe(4.99)!.libelle, "3 à 5");
  assert.equal(trancheDe(5)!.libelle, "5 et plus");
  assert.equal(trancheDe(50)!.libelle, "5 et plus");
  const paris = [
    pari({ cote: 6, statut: "gagne", mise: 10 }),
    pari({ cote: 1.3, statut: "perdu", mise: 10 }),
    pari({ cote: 2.5, statut: "gagne", mise: 10 }),
  ];
  const v = parTrancheCote(paris);
  assert.deepEqual(v.map((x) => x.libelle), ["moins de 1,5", "2 à 3", "5 et plus"]);
});
