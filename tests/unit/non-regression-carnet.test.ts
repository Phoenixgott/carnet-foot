/**
 * Non-régression : la nouvelle application doit produire EXACTEMENT les mêmes
 * résultats que le carnet d'origine (mêmes chiffres, mêmes verdicts, mêmes textes),
 * tant que le modèle n'a pas été volontairement changé.
 *
 * Chaque test exécute le code original du carnet (voir tests/helpers/carnet-original.ts)
 * et le code porté en TypeScript sur les mêmes entrées, puis compare.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnetOriginal, versJson } from "../helpers/carnet-original";
import { aleatoire, matchAleatoire, pariCarnetAleatoire, versPari } from "../helpers/generateurs";
import { pAuPlus, pPlusDe, lambdaRestant } from "../../src/core/poisson";
import { butsAttendus, moyennes } from "../../src/core/carnet-v1/modele";
import { fiabilite, infosManquantes } from "../../src/core/carnet-v1/fiabilite";
import { evaluerPlus15, evaluerPlus25 } from "../../src/core/carnet-v1/criteres";
import { analyser, niveauRisque } from "../../src/core/carnet-v1/analyse";
import { decisionAvantMatch, decisionEntreeLive, tableauCotesLive } from "../../src/core/carnet-v1/decisions";
import { couvertureLay, couverturePariContraire, resultatCashOut } from "../../src/core/couverture";
import { appreciationConversion, calculerFreebet } from "../../src/core/freebet";
import { gainPari, gainsTotaux, miseConseillee } from "../../src/core/paris";
import { eur, fr, pc } from "../../src/core/format";

const carnet = chargerCarnetOriginal();
const O = carnet.api;
const NB_MATCHS = 1000;

/** Égalité stricte de deux nombres, NaN compris. */
function memeNombre(a: number, b: number, quoi: string) {
  assert.ok(Object.is(a, b), `${quoi} : carnet ${a} ≠ app ${b}`);
}

test("Poisson : pAuPlus et pPlusDe identiques au carnet sur une grille", () => {
  for (let l = 0; l <= 6.0001; l += 0.05) {
    for (let n = 0; n <= 5; n++) memeNombre(O.pAtMost(l, n), pAuPlus(l, n), `pAtMost(${l},${n})`);
    for (const ligne of [0.5, 1.5, 2.5, 3.5]) memeNombre(O.pOver(l, ligne), pPlusDe(l, ligne), `pOver(${l},${ligne})`);
    for (const minute of [0, 12, 15, 20, 45, 89, 90, 95]) memeNombre(O.remL(l, minute), lambdaRestant(l, minute), `remL(${l},${minute})`);
  }
});

test(`Buts attendus, fiabilité, critères et analyse identiques au carnet (${NB_MATCHS} matchs variés)`, () => {
  const r = aleatoire(20260921);
  for (let i = 0; i < NB_MATCHS; i++) {
    const m = matchAleatoire(r, i);
    const copie = () => JSON.parse(JSON.stringify(m));
    const lieu = `match ${i} ${JSON.stringify(m)}`;

    memeNombre(O.lambdaOf(copie()), butsAttendus(copie()), `lambda — ${lieu}`);
    for (const cote of ["domicile", "exterieur"] as const) {
      const a = O.avgs(copie()[cote]);
      const b = moyennes(copie()[cote]);
      memeNombre(a.s, b.s, `avgs.s — ${lieu}`);
      memeNombre(a.c, b.c, `avgs.c — ${lieu}`);
    }
    assert.deepEqual(versJson(O.reliability(copie())), versJson(fiabilite(copie())), `fiabilité — ${lieu}`);
    assert.deepEqual(versJson(O.missingOf(copie())), infosManquantes(copie()), `infos manquantes — ${lieu}`);
    assert.deepEqual(versJson(O.evalM1(copie())), versJson(evaluerPlus15(copie())), `critères +1.5 — ${lieu}`);
    assert.deepEqual(versJson(O.evalM3(copie())), versJson(evaluerPlus25(copie())), `critères +2.5 — ${lieu}`);

    for (const [code, methode] of [["m1", "+1.5"], ["m3", "+2.5"]] as const) {
      const a = O.analysis(copie(), code);
      const b = analyser(copie(), methode);
      assert.equal(a.v, b.v, `verdict ${methode} — ${lieu}`);
      memeNombre(a.p, b.p, `probabilité ${methode} — ${lieu}`);
      memeNombre(a.fair, b.fair, `cote juste ${methode} — ${lieu}`);
      memeNombre(a.risk, b.risk, `risque ${methode} — ${lieu}`);
      assert.equal(O.riskLvl(a.risk), niveauRisque(b.risk), `niveau de risque ${methode} — ${lieu}`);
      assert.deepEqual(versJson(a), versJson(b), `analyse complète ${methode} — ${lieu}`);
    }
  }
});

test("Niveau de risque identique au carnet sur toute l'échelle", () => {
  for (let x = -0.1; x <= 1.1; x += 0.005) assert.equal(O.riskLvl(x), niveauRisque(x), `risque ${x}`);
  assert.equal(O.riskLvl(NaN), niveauRisque(NaN));
});

test("Gains des paris, total et bankroll identiques au carnet", () => {
  const r = aleatoire(42);
  for (let k = 0; k < 60; k++) {
    const brut = Array.from({ length: r.entier(0, 40) }, () => pariCarnetAleatoire(r));
    const paris = brut.map(versPari);
    carnet.setBets(JSON.parse(JSON.stringify(brut)));
    brut.forEach((b, i) => memeNombre(O.pnl(b), gainPari(paris[i]), `gain du pari ${JSON.stringify(b)}`));
    memeNombre(O.total(), gainsTotaux(paris), `total liste ${k}`);
  }
});

test("Couverture +1.5 (pari contraire, exchange, cash-out) : mêmes montants que le carnet", () => {
  const r = aleatoire(7);
  for (let i = 0; i < 300; i++) {
    const S = r.reel(1, 200, 1), Ocote = r.reel(1.2, 3.5), X = r.reel(1.15, 6), c = r.choix([0, 0.02, 0.05]), C = r.reel(0, 300, 1);
    carnet.els["#h1Stake"] = { value: String(S), checked: false, innerHTML: "" };
    Object.assign(carnet.els, {
      "#h1Odd": { value: String(Ocote), checked: false, innerHTML: "" },
      "#h1Opp": { value: String(X), checked: false, innerHTML: "" },
      "#h1Comm": { value: String(c * 100), checked: false, innerHTML: "" },
      "#h1Cash": { value: String(C), checked: false, innerHTML: "" },
      "#h1Out": { value: "", checked: false, innerHTML: "" },
    });
    const lieu = `S=${S} O=${Ocote} X=${X} c=${c} C=${C}`;

    carnet.setHMode("contre"); O.calcH1();
    let html = carnet.els["#h1Out"].innerHTML;
    const k = couverturePariContraire(S, Ocote, X);
    if (k.profit > 0) {
      assert.ok(html.includes(`<strong>Mise ${eur(k.miseCouverture)} sur « moins de 1,5 but »</strong>`), `mise contraire — ${lieu}`);
      assert.ok(html.includes(`Tu gagnes <b>${eur(k.profit)}</b>`), `profit contraire — ${lieu}`);
    } else {
      assert.ok(html.includes(`Couvrir te ferait perdre ${eur(-k.profit)}`), `perte contraire — ${lieu}`);
    }
    assert.ok(html.includes(`<b>+${eur(k.sansCouvrirSiBut)}</b>`) && html.includes(`<b>${eur(k.sansCouvrirSiPasDeBut)}</b>`), `scénarios — ${lieu}`);

    carnet.setHMode("lay"); O.calcH1();
    html = carnet.els["#h1Out"].innerHTML;
    const l = couvertureLay(S, Ocote, X, c);
    if (l.profitMin > 0) {
      assert.ok(html.includes(`<strong>Lay de ${eur(l.miseLay)}</strong>`), `mise lay — ${lieu}`);
      assert.ok(html.includes(`Tu gagnes au moins <b>${eur(l.profitMin)}</b>. Il faut ${eur(l.responsabilite)}`), `profit lay — ${lieu}`);
    } else {
      assert.ok(html.includes("Pas rentable"), `lay non rentable — ${lieu}`);
    }

    carnet.setHMode("cash"); O.calcH1();
    html = carnet.els["#h1Out"].innerHTML;
    const g = resultatCashOut(S, C);
    assert.ok(html.includes(g > 0 ? `Tu gagnes ${eur(g)}` : `Tu perds ${eur(-g)}`), `cash-out — ${lieu}`);
  }
});

test("Freebet (autre bookmaker et exchange) : mêmes montants que le carnet", () => {
  const r = aleatoire(99);
  for (let i = 0; i < 300; i++) {
    const e = {
      qMise: r.reel(5, 200, 0), qCote: r.reel(1.5, 3), qCoteInverse: r.reel(1.5, 3), qCommission: r.choix([0, 0.02, 0.05]),
      fMontant: r.reel(5, 200, 0), fCote: r.reel(2, 8), fCoteInverse: r.reel(1.1, 2), fCommission: r.choix([0, 0.02, 0.05]),
    };
    const champs: Record<string, number> = {
      "#qStake": e.qMise, "#qOdd": e.qCote, "#qOpp": e.qCoteInverse, "#qComm": e.qCommission * 100,
      "#fStake": e.fMontant, "#fOdd": e.fCote, "#fOpp": e.fCoteInverse, "#fComm": e.fCommission * 100,
    };
    for (const [sel, v] of Object.entries(champs)) carnet.els[sel] = { value: String(v), checked: false, innerHTML: "" };
    for (const mode of ["book", "lay"] as const) {
      for (const sel of ["#qOut", "#fOut", "#fbTotal"]) carnet.els[sel] = { value: "", checked: false, innerHTML: "" };
      carnet.setFbMode(mode);
      O.calcFB();
      const res = calculerFreebet({ ...e, mode });
      const lieu = `${mode} ${JSON.stringify(e)}`;
      const q = carnet.els["#qOut"].innerHTML, f = carnet.els["#fOut"].innerHTML, t = carnet.els["#fbTotal"].innerHTML;
      assert.ok(q.includes(`<strong>Mise ${eur(res.qualif.miseCouverture)}</strong>`), `mise qualif — ${lieu}`);
      assert.ok(q.includes(`<b>${eur(res.qualif.resultat)}</b>`), `résultat qualif — ${lieu}`);
      assert.ok(q.includes(`answer ${res.qualif.resultat > -e.qMise * 0.05 ? "ok" : "mid"}`), `appréciation qualif — ${lieu}`);
      assert.ok(f.includes(`<strong>Mise ${eur(res.freebet.miseCouverture)}</strong>`), `mise freebet — ${lieu}`);
      assert.ok(f.includes(`tu gagnes <b>${eur(res.freebet.resultat)}</b>`), `résultat freebet — ${lieu}`);
      assert.ok(t.includes(`>${eur(res.total)}</b>`), `total — ${lieu}`);
      assert.ok(t.includes(`Tu transformes ${pc(res.conversion)} du freebet`), `conversion — ${lieu}`);
      assert.ok(t.includes(`<div class="answer ${appreciationConversion(res.conversion)}">`), `appréciation conversion — ${lieu}`);
    }
  }
});

test("Décisions « j'entre ? » (+1.5) et « je parie ? » (+2.5) : mêmes verdicts, textes et mises que le carnet", () => {
  const r = aleatoire(1234);
  const reglages = { bank: 250, pct: 2 };
  const brut = Array.from({ length: 12 }, () => pariCarnetAleatoire(r));
  carnet.setBets(JSON.parse(JSON.stringify(brut)));
  carnet.setSettings(reglages);
  const miseBase = miseConseillee(brut.map(versPari), { depart: 250, pctMise: 2 });

  for (let i = 0; i < 400; i++) {
    const m = matchAleatoire(r, i);
    const avecMatch = r.chance(0.7);
    carnet.setData({ matchs: [JSON.parse(JSON.stringify(m))] });
    const lambda = r.reel(0.5, 4.5), minute = r.entier(-5, 95), cote = r.reel(1.1, 3.2);
    const scoreNul = r.chance(0.85), anime = r.chance(0.8), compos = r.chance(0.7);
    const set = (sel: string, value: string, checked = false) => (carnet.els[sel] = { value, checked, innerHTML: "" });
    set("#l1Match", avecMatch ? m.id : ""); set("#l1Lambda", String(lambda)); set("#l1Min", String(minute));
    set("#l1Odd", String(cote)); set("#l1Score", "", scoreNul); set("#l1Dyn", "", anime); set("#l1Out", "");
    O.calcL1();
    const d = decisionEntreeLive({ lambda, minute, cote, scoreNul, anime, evaluation: avecMatch ? evaluerPlus15(m) : null, miseBase });
    const h = carnet.els["#l1Out"].innerHTML;
    const lieu = `live λ=${lambda} min=${minute} cote=${cote} 0-0=${scoreNul} animé=${anime} match=${avecMatch}`;
    assert.ok(h.includes(`<div class="answer ${d.v}"><strong>${d.titre}</strong><p>${d.pourquoi}</p>`), `verdict — ${lieu}`);
    assert.equal(h.includes("Mise conseillée"), d.mise !== null, `présence de la mise — ${lieu}`);
    if (d.mise !== null) assert.ok(h.includes(`Mise conseillée : <b>${eur(d.mise)}</b>`), `mise — ${lieu}`);
    for (const x of tableauCotesLive(lambda)) assert.ok(h.includes(`${x.minute}ᵉ min<b>${fr(x.coteMini)}</b>`), `tableau ${x.minute} — ${lieu}`);

    set("#v3Match", avecMatch ? m.id : ""); set("#v3Lambda", String(lambda)); set("#v3Odd", String(cote + 0.4));
    set("#v3Lineup", "", compos); set("#v3Out", "");
    O.calcV3();
    const d3 = decisionAvantMatch({ lambda, cote: cote + 0.4, compositionsVues: compos, evaluation: avecMatch ? evaluerPlus25(m) : null, miseBase });
    const h3 = carnet.els["#v3Out"].innerHTML;
    const lieu3 = `avant-match λ=${lambda} cote=${cote + 0.4} compos=${compos} match=${avecMatch}`;
    assert.ok(h3.includes(`<div class="answer ${d3.v}"><strong>${d3.titre}</strong><p>${O.esc(d3.pourquoi)}</p>`), `verdict — ${lieu3}`);
    assert.equal(h3.includes("Mise conseillée"), d3.mise !== null, `présence de la mise — ${lieu3}`);
    if (d3.mise !== null) assert.ok(h3.includes(`Mise conseillée : <b>${eur(d3.mise)}</b>`), `mise — ${lieu3}`);
    assert.ok(h3.includes(`<b>${fr(d3.coteJuste)}</b>`) && h3.includes(`<b>${pc(d3.p)}</b>`), `cote juste et chances — ${lieu3}`);
  }
});

test("Cas limites écrits à la main : égalités exactes sur les seuils", () => {
  const base = (): Record<string, unknown> => ({
    id: "limite", date: "2026-09-22", ligue: "Ligue 1", moyenneButsLigue: 2.7,
    domicile: { nom: "Lens", joues: 10, marques: 25, encaisses: 10, pctOver15: 70, pctOver25: 60, derniersButsMarques: [2, 2, 2, 1] },
    exterieur: { nom: "Brest", joues: 6, marques: 6, encaisses: 6, pctOver15: 70, pctOver25: 50, derniersButsMarques: [1, 1, 1, 1] },
    h2h: { joues: 5, over25: 3 }, contexte: "normal", absents: [], cotes: { over15: 1.3, over25: 1.9 },
  });
  const variantes: Array<(m: Record<string, any>) => void> = [
    () => {},                                            // forme = 70 % pile, 1 but/match pile, h2h 60 % pile
    (m) => { m.h2h = { joues: 5, over25: 2 }; },          // h2h 40 % pile
    (m) => { m.moyenneButsLigue = 2.71; },
    (m) => { m.exterieur.pctOver15 = 69; },
    (m) => { m.exterieur.marques = 7; m.exterieur.encaisses = 7; },
    (m) => { m.defenseAffaiblie = true; m.moyenneButsLigue = 2.8; },
    (m) => { m.contexte = "retour_coupe_retard"; },
    (m) => { m.domicile.derniersButsMarques = [2, 2, 1, 1]; }, // forme sous 70 %
  ];
  for (const [i, v] of variantes.entries()) {
    const m = base(); v(m);
    const copie = () => JSON.parse(JSON.stringify(m));
    assert.deepEqual(versJson(O.evalM1(copie())), versJson(evaluerPlus15(copie())), `variante ${i} +1.5`);
    assert.deepEqual(versJson(O.evalM3(copie())), versJson(evaluerPlus25(copie())), `variante ${i} +2.5`);
    assert.deepEqual(versJson(O.analysis(copie(), "m3")), versJson(analyser(copie(), "+2.5")), `variante ${i} analyse`);
  }
});
