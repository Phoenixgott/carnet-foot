/**
 * Mises (Kelly fractionné, plafonds), objectifs et budget mensuel, simulateur « et si j'avais
 * parié X ». Cas calculés à la main.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alerteMise,
  completerReglagesMises,
  fractionKelly,
  miseConseilleeSelonReglages,
  miseEngageeCeJour,
  miseKelly,
  REGLAGES_MISES_DEFAUT,
  type ReglagesMises,
} from "../../src/core/mises";
import { completerReglagesObjectifs, joursDansMois, moisDe, REGLAGES_OBJECTIFS_DEFAUT, suiviMois } from "../../src/core/objectifs";
import { simuler } from "../../src/core/simulateur";
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

test("Kelly : f* = (p × cote − 1) / (cote − 1), jamais négatif, réduit par la fraction choisie", () => {
  // p = 0,55, cote = 2 (b = 1) : f* = (0,55×2 − 1)/1 = 0,10
  proche(fractionKelly(0.55, 2, 1), 0.1);
  proche(fractionKelly(0.55, 2, 0.5), 0.05, 1e-9); // demi-Kelly
  // Pas d'avantage (cote juste) : f* = 0
  proche(fractionKelly(0.5, 2, 1), 0);
  // Désavantage : jamais négatif
  proche(fractionKelly(0.3, 2, 1), 0);
  assert.equal(fractionKelly(NaN, 2, 1), 0);
  assert.equal(fractionKelly(0.5, 1, 1), 0, "cote impossible");
  proche(miseKelly(200, 0.55, 2, 1), 20);
  proche(miseKelly(200, 0.55, 2, 0.5), 10);
});

test("Mise conseillée selon les réglages : fixe (règle du carnet) ou Kelly avec repli si p/cote manquent", () => {
  const paris: Pari[] = [];
  const bankroll = { depart: 200, pctMise: 2 };
  const fixe: ReglagesMises = { ...REGLAGES_MISES_DEFAUT, methode: "fixe" };
  const kelly: ReglagesMises = { ...REGLAGES_MISES_DEFAUT, methode: "kelly", fractionKelly: 1 };
  proche(miseConseilleeSelonReglages({ paris, reglagesBankroll: bankroll, reglagesMises: fixe }).montant, 4); // 2 % de 200
  const sansProba = miseConseilleeSelonReglages({ paris, reglagesBankroll: bankroll, reglagesMises: kelly });
  assert.equal(sansProba.methode, "fixe", "pas de p/cote : repli sur la mise fixe");
  const avecProba = miseConseilleeSelonReglages({ paris, reglagesBankroll: bankroll, reglagesMises: kelly, p: 0.55, cote: 2 });
  assert.equal(avecProba.methode, "kelly");
  proche(avecProba.montant, 20); // 10 % de 200
});

test("Alertes de mise : plafond par pari et par jour, avertissement seulement (jamais un blocage)", () => {
  const paris = [pari({ date: "2026-09-01", mise: 15 }), pari({ date: "2026-09-01", mise: 10 }), pari({ date: "2026-09-02", mise: 100 })];
  const reglages: ReglagesMises = { ...REGLAGES_MISES_DEFAUT, plafondParPari: 20, plafondParJour: 30 };
  assert.equal(miseEngageeCeJour(paris, "2026-09-01"), 25);
  const a1 = alerteMise(paris, reglages, "2026-09-01", 10);
  assert.equal(a1.parPari, false);
  assert.deepEqual(a1.parJour, { depasse: true, dejaEngage: 25, plafond: 30 }); // 25 + 10 > 30
  const a2 = alerteMise(paris, reglages, "2026-09-03", 25);
  assert.equal(a2.parPari, true); // > 20
  assert.deepEqual(a2.parJour, { depasse: false, dejaEngage: 0, plafond: 30 });
  const sansPlafond = alerteMise(paris, REGLAGES_MISES_DEFAUT, "2026-09-01", 9999);
  assert.deepEqual(sansPlafond, { parPari: false, parJour: null });
});

test("Réglages de mises : valeurs manquantes ou fausses remplacées par le défaut", () => {
  assert.deepEqual(completerReglagesMises(undefined), REGLAGES_MISES_DEFAUT);
  assert.deepEqual(completerReglagesMises({ methode: "kelly", fractionKelly: 0.25, plafondParPari: 50 }), {
    methode: "kelly",
    fractionKelly: 0.25,
    plafondParPari: 50,
    plafondParJour: null,
  });
  assert.equal(completerReglagesMises({ fractionKelly: 5 }).fractionKelly, REGLAGES_MISES_DEFAUT.fractionKelly, "fraction > 1 rejetée");
  assert.equal(completerReglagesMises({ plafondParPari: -10 }).plafondParPari, null);
});

test("Objectif et budget mensuel : mois AAAA-MM, jours du mois, progression, alertes", () => {
  assert.equal(moisDe("2026-09-21"), "2026-09");
  assert.equal(joursDansMois("2026-09"), 30);
  assert.equal(joursDansMois("2026-02"), 28);
  assert.equal(joursDansMois("2028-02"), 29, "année bissextile");

  const paris = [
    pari({ date: "2026-09-05", statut: "gagne", cote: 2, mise: 20 }), // +20
    pari({ date: "2026-09-10", statut: "perdu", mise: 10 }), // -10
    pari({ date: "2026-08-31", statut: "gagne", cote: 2, mise: 100 }), // hors mois
    pari({ date: "2026-09-15", statut: "attente", mise: 5 }), // pas terminé
  ];
  const s = suiviMois(paris, { gainVise: 20, budgetMax: 25 }, "2026-09-21");
  assert.deepEqual([s.nb, s.gains, s.miseEngagee], [2, 10, 30]);
  assert.equal(s.joursDansMois, 30);
  assert.equal(s.joursEcoules, 21);
  assert.equal(s.joursRestants, 9);
  proche(s.progression, 0.5); // 10 / 20
  assert.equal(s.objectifAtteint, false);
  assert.equal(s.budgetDepasse, true); // 30 > 25

  assert.deepEqual(completerReglagesObjectifs(undefined), REGLAGES_OBJECTIFS_DEFAUT);
  assert.equal(completerReglagesObjectifs({ gainVise: -5 }).gainVise, null);
});

test("Simulateur, mise fixe : recalcule gains et bankroll ; les paris « manuel » gardent leur gain réel", () => {
  const paris = [
    pari({ ordre: 0, statut: "gagne", cote: 2, mise: 100 }), // réel : +100 ; simulé (fixe 10) : +10
    pari({ ordre: 1, statut: "perdu", mise: 5 }), // réel : -5 ; simulé : -10
    pari({ ordre: 2, methode: "Freebet", statut: "manuel", pnl: 8, mise: 100 }), // gardé tel quel : +8
    pari({ ordre: 3, statut: "attente" }),
  ];
  const r = simuler(paris, { type: "fixe", montant: 10 });
  assert.equal(r.nb, 3); // sans le pari en attente
  assert.equal(r.nbNonRejoues, 1);
  proche(r.gainsSimules, 10 - 10 + 8);
  proche(r.bankrollFinale, 10 - 10 + 8);
  proche(r.miseSimuleeTotale, 20); // le freebet ne compte pas de mise simulée
  proche(r.roiSimule, 8 / 20); // ROI = gains simulés (freebet compris) ÷ mise simulée (freebet exclue), comme le bilan
  assert.deepEqual(
    r.points.map((p) => [p.miseSimulee, p.gainSimule, p.rejoue]),
    [
      [10, 10, true],
      [10, -10, true],
      [0, 8, false],
    ],
  );
  // Comparaison au réel
  proche(r.reel.gains, 100 - 5 + 8);
  proche(r.reel.mise, 100 + 5); // freebet hors mise engagée
});

test("Simulateur, pourcentage de la bankroll : mise recalculée à chaque pari (composée)", () => {
  const paris = [
    pari({ ordre: 0, statut: "gagne", cote: 2, mise: 10 }), // 10 % de 200 = 20 → +20 → bankroll 220
    pari({ ordre: 1, statut: "perdu", mise: 10 }), // 10 % de 220 = 22 → -22 → bankroll 198
  ];
  const r = simuler(paris, { type: "pourcent", pct: 10, bankrollDepart: 200 });
  proche(r.points[0].miseSimulee, 20);
  proche(r.points[0].bankroll, 220);
  proche(r.points[1].miseSimulee, 22);
  proche(r.points[1].bankroll, 198);
  proche(r.bankrollFinale, 198);
  proche(r.drawdown.montant, 22); // du sommet 220 au creux 198
});
