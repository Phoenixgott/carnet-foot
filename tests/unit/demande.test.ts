/**
 * Demande à l'autre conversation Claude : saison d'après la date, compétitions, nombre de matchs.
 * Non-régression : à réglages égaux, le texte est celui du carnet d'origine (fonction buildReq),
 * aux seuls changements voulus de la phase 2 près.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnetOriginal, versJson } from "../helpers/carnet-original";
import {
  COMPETITIONS,
  COMPETITIONS_PAR_DEFAUT,
  construireDemande,
  construireDemandeComplements,
  construireDemandeCotes,
} from "../../src/core/demande";
import { saisonDe, saisonPrecedente } from "../../src/core/saison";
import type { Match } from "../../src/core/types";

const carnet = chargerCarnetOriginal();

/** Les seules différences voulues avec la demande du carnet. */
function versionPhase2(texteCarnet: string): string {
  return texteCarnet
    .replace("les matchs européens les matchs féminins", "les matchs européens, les matchs féminins")
    .replace(
      `- "cotes" : cotes « plus de 1,5 but » et « plus de 2,5 buts ». D'abord Unibet`,
      `- "cotes" : cotes « plus de 1,5 but » (over15), « moins de 1,5 but » (under15), « plus de 2,5 buts » (over25) et « moins de 2,5 buts » (under25), toutes chez le MÊME bookmaker. D'abord Unibet`,
    )
    .replace(`"cotes":{"over15":1.27,"over25":1.80,"bookmaker":"Unibet"}`, `"cotes":{"over15":1.27,"under15":3.60,"over25":1.80,"under25":1.95,"bookmaker":"Unibet"}`);
}

test("Saison d'après la date : bascule au 1er juillet", () => {
  assert.equal(saisonDe("2026-09-22"), "2026-2027");
  assert.equal(saisonDe("2027-03-10"), "2026-2027");
  assert.equal(saisonDe("2026-06-30"), "2025-2026");
  assert.equal(saisonDe("2026-07-01"), "2026-2027");
  assert.equal(saisonPrecedente("2026-2027"), "2025-2026");
  assert.throws(() => saisonDe("22/09/2026"));
});

test("Demande du jour : identique au carnet (saison 2026-2027), hors changements voulus", () => {
  for (const choisies of [[...COMPETITIONS_PAR_DEFAUT], ["Ligue 1", "WSL", "Qualifs Euro"], COMPETITIONS.map((c) => c.cle)]) {
    carnet.setChosen(choisies);
    carnet.els["#reqDate"] = { value: "2026-09-22", checked: false, innerHTML: "" };
    carnet.els["#reqOne"] = { value: "", checked: false, innerHTML: "" };
    const attendu = versionPhase2(carnet.api.buildReq());
    const obtenu = construireDemande({ date: "2026-09-22", competitions: choisies, parReponse: 8, maxTotal: null });
    assert.equal(obtenu, attendu);
  }
});

test("Demande pour un seul match : identique au carnet, hors changements voulus", () => {
  carnet.els["#reqDate"] = { value: "2026-09-22", checked: false, innerHTML: "" };
  carnet.els["#reqOne"] = { value: "Lens – Brest", checked: false, innerHTML: "" };
  const attendu = versionPhase2(carnet.api.buildReq());
  assert.equal(construireDemande({ date: "2026-09-22", unMatch: "Lens – Brest", competitions: [], parReponse: 8, maxTotal: null }), attendu);
});

test("Demande : saison calculée, nombre de matchs par réponse et au total", () => {
  const t = construireDemande({ date: "2027-08-14", competitions: ["Ligue 1", "Frauen-Bundesliga"], parReponse: 6, maxTotal: 15 });
  assert.match(t, /saison 2027-2028, même si le match est une coupe/);
  assert.match(t, /fin de la saison 2026-2027/);
  assert.ok(!t.includes("2026-2027,"), "l'ancienne saison écrite en dur a disparu");
  assert.match(t, /S'il y a plus de 6 matchs, donne les 6 premiers par heure/);
  assert.match(t, /Garde au plus 15 matchs au total/);
  assert.match(t, /- Ligue 1 \(France\)\n- Frauen-Bundesliga \(Allemagne, féminin\)/);
  assert.ok(!t.includes("Premier League"));
  assert.match(t, /samedi 14 août 2027 \(date 2027-08-14\)/);
  assert.match(t, /"id":"2027-08-14-lens-brest"/);
  // L'exemple de format reste un JSON valide
  const exemple = t.slice(t.lastIndexOf('{"matchs"'));
  assert.equal(JSON.parse(exemple).matchs[0].cotes.under25, 1.95);
});

test("Demande de compléments : identique au carnet, hors changements voulus", () => {
  const m = (id: string, dom: string, ext: string): Match => ({ id, date: "2026-09-22", ligue: "Ligue 1", domicile: { nom: dom }, exterieur: { nom: ext } });
  const liste = [
    { m: m("a", "Lens", "Brest"), manque: ["% de matchs à 2+ buts (Brest)", "confrontations directes"] },
    { m: m("b", "Metz", "Lille"), manque: ["derniers matchs (Metz, Lille)"] },
  ];
  const attendu = versionPhase2(carnet.api.buildFollow(liste.map((x) => ({ m: x.m, miss: x.manque }))));
  assert.equal(construireDemandeComplements(liste, "2026-09-22"), attendu);
});

test("Demande de cotes du jour J : ids exacts, 4 cotes, bookmaker du dernier relevé", () => {
  const t = construireDemandeCotes([
    {
      id: "2026-09-22-lens-brest",
      date: "2026-09-22",
      heure: "21:00",
      ligue: "Ligue 1",
      domicile: { nom: "Lens" },
      exterieur: { nom: "Brest" },
      historiqueCotes: [{ le: "2026-09-21T10:00:00Z", over15: 1.3, over25: 1.9, under15: null, under25: null, bookmaker: "Winamax", origine: "import" }],
    },
  ]);
  assert.match(t, /Lens – Brest \(Ligue 1, 2026-09-22 à 21:00\), id "2026-09-22-lens-brest" : dernier relevé chez Winamax/);
  for (const k of ["over15", "under15", "over25", "under25"]) assert.ok(t.includes(`"${k}"`));
  JSON.parse(t.slice(t.indexOf('{"matchs"'), t.lastIndexOf("}") + 1));
});

test("Liste des compétitions identique au carnet", () => {
  const ligues = versJson(carnet.api.LEAGUES) as Array<[string, string]>;
  assert.deepEqual(
    COMPETITIONS.map((c) => [c.cle, c.libelle]),
    ligues,
  );
});
