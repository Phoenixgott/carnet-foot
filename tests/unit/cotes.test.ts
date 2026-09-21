/**
 * Cotes : marge du bookmaker (cas calculés à la main), cote minimale, alertes, suivi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyser } from "../../src/core/carnet-v1/analyse";
import { alertesCote, amorcerSuivi, coteMinimale, nouvellesAlertes, sens, suivreCotes } from "../../src/core/cotes";
import { lireSaisie } from "../../src/core/format";
import { margeBookmaker, probabiliteSansMarge } from "../../src/core/marge";
import type { Match } from "../../src/core/types";

const proche = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

function match(extra: Partial<Match> = {}): Match {
  return {
    id: "m1",
    date: "2026-09-22",
    ligue: "Ligue 1",
    moyenneButsLigue: 2.85,
    domicile: { nom: "Lens", joues: 6, marques: 11, encaisses: 7, pctOver15: 83, pctOver25: 67, derniersButsMarques: [2, 1, 3, 2] },
    exterieur: { nom: "Brest", joues: 6, marques: 8, encaisses: 9, pctOver15: 83, pctOver25: 50, derniersButsMarques: [1, 2, 1, 2] },
    h2h: { joues: 6, over25: 4 },
    ...extra,
  };
}

test("Marge du bookmaker : cas connus", () => {
  // 1/1,80 + 1/1,95 − 1 = 0,5556 + 0,5128 − 1 = 0,0684
  proche(margeBookmaker(1.8, 1.95), 1 / 1.8 + 1 / 1.95 - 1);
  assert.equal(margeBookmaker(1.8, 1.95).toFixed(4), "0.0684");
  // Cotes justes : pas de marge
  proche(margeBookmaker(2, 2), 0);
  // Probabilité sans marge : ramenée pour que plus + moins = 1
  proche(probabiliteSansMarge(1.8, 1.95) + probabiliteSansMarge(1.95, 1.8), 1);
  // Inconnues ou impossibles
  for (const [a, b] of [[null, 1.9], [1.8, undefined], [1, 1.9], [1.8, 0.5]] as const) assert.ok(Number.isNaN(margeBookmaker(a, b)));
});

test("Saisie d'une cote : virgule acceptée, case vide = null, texte = refusé", () => {
  assert.equal(lireSaisie("1,85"), 1.85);
  assert.equal(lireSaisie(" 2.1 "), 2.1);
  assert.equal(lireSaisie(""), null);
  assert.equal(lireSaisie("abc"), undefined);
  assert.equal(lireSaisie("1,8,5"), undefined);
});

test("Cote minimale : choisie à la main d'abord, sinon cote mini +2.5 ; aucune par défaut pour +1,5", () => {
  const m = match();
  const fair = analyser(m, "+2.5").fair;
  assert.ok(Number.isFinite(fair));
  assert.deepEqual(coteMinimale(m, "over25"), { valeur: fair, origine: "calculee" });
  assert.equal(coteMinimale(m, "over15"), null);
  const choisie = match({ coteCible: { over15: 1.35, over25: 1.9 } });
  assert.deepEqual(coteMinimale(choisie, "over15"), { valeur: 1.35, origine: "choisie" });
  assert.deepEqual(coteMinimale(choisie, "over25"), { valeur: 1.9, origine: "choisie" });
  assert.deepEqual(coteMinimale(match({ coteCible: { over25: null } }), "over25")?.origine, "calculee");
  // Sans données, pas de cote mini calculée
  assert.equal(coteMinimale({ id: "x", domicile: { nom: "A" }, exterieur: { nom: "B" } }, "over25"), null);
});

test("Alerte : active quand la cote atteint la cote minimale (au centime affiché)", () => {
  const base = match({ coteCible: { over25: 1.9, over15: 1.35 } });
  assert.deepEqual(alertesCote({ ...base, cotes: { over25: 1.85, over15: 1.3 } }), []);
  const a = alertesCote({ ...base, cotes: { over25: 1.9, over15: 1.4 } });
  assert.deepEqual(a.map((x) => x.marche), ["over15", "over25"]);
  assert.match(a[1].texte, /^Lens – Brest : plus de 2,5 buts à 1,90 \(cote mini choisie : 1,90\)$/);
  // Cote mini calculée 1,7999… affichée 1,80 : une cote de 1,80 l'atteint
  const m = match({ cotes: { over25: 1.8 }, coteCible: { over25: 1.7999 } });
  assert.equal(alertesCote(m).length, 1);
});

test("Nouvelles alertes : seulement celles qui n'étaient pas déjà actives", () => {
  const avant = match({ coteCible: { over25: 1.9 }, cotes: { over25: 1.8 } });
  const apres = { ...avant, cotes: { over25: 1.95 } };
  assert.equal(nouvellesAlertes([avant], [apres]).length, 1);
  assert.equal(nouvellesAlertes([apres], [{ ...apres, cotes: { over25: 2 } }]).length, 0, "déjà atteinte : pas de nouvelle notification");
  assert.equal(nouvellesAlertes([], [apres]).length, 1, "nouveau match déjà au-dessus : notifié");
});

test("Suivi : relevé ajouté seulement si les cotes changent ; amorçage des cotes d'avant", () => {
  const m = match({ cotes: { over25: 1.8, bookmaker: "Unibet" } });
  const amorce = amorcerSuivi(m);
  assert.equal(amorce.historiqueCotes?.length, 1);
  assert.equal(amorce.historiqueCotes?.[0].le, null);
  assert.equal(amorcerSuivi(amorce), amorce, "pas d'amorçage si le suivi existe");
  assert.equal(suivreCotes(amorce, "2026-09-22T10:00:00Z", "saisie"), amorce, "mêmes cotes : rien d'ajouté");
  const change = suivreCotes({ ...amorce, cotes: { over25: 1.85, bookmaker: "Unibet" } }, "2026-09-22T10:00:00Z", "saisie");
  assert.equal(change.historiqueCotes?.length, 2);
  assert.equal(change.historiqueCotes?.[1].origine, "saisie");
  assert.equal(suivreCotes(match({ cotes: null }), "2026-09-22T10:00:00Z", "import").historiqueCotes, undefined);
  assert.equal(sens(1.8, 1.85), 1);
  assert.equal(sens(1.8, 1.7), -1);
  assert.equal(sens(null, 1.7), 0);
});
