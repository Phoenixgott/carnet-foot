/**
 * Import des réponses de l'autre conversation Claude : extraction, validation,
 * doublons, fusion intelligente et suivi des cotes.
 * Non-régression : l'extraction et la fusion donnent les mêmes résultats que le carnet
 * (fonctions extractAll et deepMerge de l'artefact d'origine).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCarnetOriginal, versJson } from "../helpers/carnet-original";
import { aleatoire, matchAleatoire } from "../helpers/generateurs";
import { exempleFormat } from "../../src/core/demande";
import type { Match } from "../../src/core/types";
import { ErreurImport } from "../../src/data/import-carnet";
import { analyserImportMatchs, extraireMatchs, fusionProfonde, nettoyerMatch } from "../../src/data/import-matchs";

const carnet = chargerCarnetOriginal();
const MAINTENANT = new Date("2026-09-22T09:30:00Z");
const PLUS_TARD = new Date("2026-09-22T18:00:00Z");

const bloc = (o: unknown) => "```json\n" + JSON.stringify(o, null, 1) + "\n```";

function matchComplet(dom: string, ext: string, extra: Partial<Match> = {}): Match {
  return {
    id: `2026-09-22-${dom.toLowerCase()}-${ext.toLowerCase()}`,
    date: "2026-09-22",
    heure: "21:00",
    ligue: "Ligue 1",
    moyenneButsLigue: 2.85,
    domicile: { nom: dom, joues: 6, marques: 11, encaisses: 7, pctOver15: 83, pctOver25: 67, derniersButsMarques: [2, 1, 3, 2] },
    exterieur: { nom: ext, joues: 6, marques: 8, encaisses: 9, pctOver15: 83, pctOver25: 50, derniersButsMarques: [1, 2, 1, 2] },
    h2h: { joues: 6, over25: 4 },
    contexte: "normal",
    absents: [],
    absenceOffensive: false,
    meilleurButeurAbsent: false,
    defenseAffaiblie: false,
    ...extra,
  };
}

test("Extraction : mêmes matchs que le carnet sur des réponses variées", () => {
  const textes = [
    exempleFormat("2026-09-22"),
    "Voici les matchs :\n" + bloc({ matchs: [matchComplet("Lens", "Brest")] }) + "\nSUITE DISPONIBLE — écris « continue »",
    bloc({ matchs: [matchComplet("Lens", "Brest")] }) + "\n\n" + bloc({ matchs: [matchComplet("Metz", "Lille")] }),
    '```\n{"matchs":[{"domicile":{"nom":"A"},"exterieur":{"nom":"B"},},]}\n```',
    "Réponse : {“matchs”:[{“domicile”:{“nom”:“A”},“exterieur”:{“nom”:“B”}}]} fin",
    JSON.stringify([matchComplet("PSG", "OM")]),
    '{"matchs":[]}',
  ];
  for (const t of textes) {
    assert.deepEqual(extraireMatchs(t).matchs, versJson(carnet.api.extractAll(t)), t.slice(0, 60));
  }
  assert.throws(() => extraireMatchs("rien de lisible"), ErreurImport);
  assert.throws(() => extraireMatchs("   "), /vide/);
  assert.equal(extraireMatchs(textes[1]).suiteDisponible, true);
  assert.equal(extraireMatchs(textes[0]).suiteDisponible, false);
});

test("Extraction : un export du carnet ou une sauvegarde collés ici sont redirigés", () => {
  assert.throws(() => extraireMatchs('{"app":"carnet-paris-foot","type":"export-complet"}'), /Importer depuis le carnet/);
  assert.throws(() => extraireMatchs('{"app":"carnet-foot","type":"sauvegarde"}'), /Restaurer une sauvegarde/);
});

test("Fusion : identique au deepMerge du carnet (500 paires de matchs)", () => {
  const r = aleatoire(77);
  for (let i = 0; i < 500; i++) {
    const a = JSON.parse(JSON.stringify(matchAleatoire(r, i)));
    const b = JSON.parse(JSON.stringify(matchAleatoire(r, i + 1000)));
    assert.deepEqual(fusionProfonde(a, b), versJson(carnet.api.deepMerge(a, b)));
  }
});

test("La réponse type de la demande s'importe sans avertissement", () => {
  const a = analyserImportMatchs(exempleFormat("2026-09-22"), [], MAINTENANT);
  assert.equal(a.nouveaux.length, 1);
  assert.deepEqual(a.avertissements, []);
  assert.deepEqual(a.ignores, []);
  const m = a.nouveaux[0];
  assert.equal(m.id, "2026-09-22-lens-brest");
  assert.equal(m.cotes?.under25, 1.95);
  assert.equal(m.historiqueCotes?.length, 1, "les cotes reçues ouvrent le suivi");
  assert.equal(m.historiqueCotes?.[0].le, MAINTENANT.toISOString());
});

test("Validation : valeurs impossibles écartées (⏳) et signalées, formats courants acceptés", () => {
  const brut = {
    date: "22/09/2026",
    heure: "21h00",
    moyenneButsLigue: "2,85",
    domicile: { nom: " Lens ", joues: 6, marques: 11, encaisses: 7, pctOver15: 150, pctOver25: "abc", derniersButsMarques: [2, "1", -1, null] },
    exterieur: { nom: "Brest", joues: 6.5, marques: 8, encaisses: 9 },
    h2h: { joues: 4, over25: 6 },
    cotes: { over15: 0.9, over25: "1,80", under25: 1.95, bookmaker: 12 },
    absenceOffensive: "oui",
    defenseAffaiblie: "peut-être",
    absents: "Lens : X (blessé)",
    contexte: "choc",
    historiqueCotes: [{ faux: true }],
  };
  const { match: m, avertissements } = nettoyerMatch(brut, 1);
  assert.ok(m);
  assert.equal(m.date, "2026-09-22");
  assert.equal(m.heure, "21:00");
  assert.equal(m.moyenneButsLigue, 2.85);
  assert.equal(m.domicile?.nom, "Lens");
  assert.equal(m.domicile?.pctOver15, null);
  assert.equal(m.domicile?.pctOver25, null);
  assert.deepEqual(m.domicile?.derniersButsMarques, [2, 1, null, null]);
  assert.equal(m.exterieur?.joues, null);
  assert.equal(m.h2h?.joues, 4);
  assert.equal(m.h2h?.over25, null, "plus de matchs à 3+ buts que de matchs joués : impossible");
  assert.equal(m.cotes?.over15, null);
  assert.equal(m.cotes?.over25, 1.8);
  assert.equal(m.cotes?.bookmaker, null);
  assert.equal(m.absenceOffensive, true);
  assert.equal(m.defenseAffaiblie, null);
  assert.deepEqual(m.absents, ["Lens : X (blessé)"]);
  assert.equal(m.contexte, "choc", "contexte inconnu gardé, comme dans le carnet");
  assert.equal(m.historiqueCotes, undefined, "le suivi des cotes ne vient jamais d'une réponse");
  assert.equal(m.id, "2026-09-22|lens|brest");
  const texte = avertissements.join("\n");
  for (const f of ["% de matchs à 2+ buts (Lens) vaut 150", "% de matchs à 3+ buts (Lens)", "derniers matchs (Lens) vaut -1", "matchs joués (Brest) vaut 6.5", "confrontations directes à 3+ buts vaut 6", "cote plus de 1,5 vaut 0.9", "bookmaker vaut 12", "défense affaiblie", "contexte « choc » inconnu"]) {
    assert.ok(texte.includes(f), `avertissement attendu : ${f}\n${texte}`);
  }
  assert.equal(nettoyerMatch({ domicile: { nom: "A" } }, 3).match, null);
  assert.match(nettoyerMatch({ domicile: { nom: "A" } }, 3).avertissements[0], /Match n° 3 sans ses deux équipes/);
  assert.equal(nettoyerMatch({ date: "2026-02-30", domicile: { nom: "A" }, exterieur: { nom: "B" } }, 1).match?.date, null);
});

test("Doublons : même id, ou même date et mêmes équipes ; l'identifiant existant est gardé", () => {
  const existant = matchComplet("Lens", "Brest", { id: "ancien-id" });
  const recu = { ...matchComplet("Lens", "Brest"), id: "2026-09-22-lens-brest", journee: "6e journée" };
  const a = analyserImportMatchs(bloc({ matchs: [recu] }), [existant], MAINTENANT);
  assert.equal(a.nouveaux.length, 0);
  assert.equal(a.misAJour.length, 1);
  assert.equal(a.misAJour[0].apres.id, "ancien-id");
  assert.deepEqual(a.misAJour[0].champs, ["journée"]);

  // Deux fois le même match dans une réponse : fusionnés, signalés
  const b = analyserImportMatchs(
    bloc({ matchs: [{ ...matchComplet("Metz", "Lille"), absents: null }, { ...matchComplet("Metz", "Lille"), id: undefined, absents: ["Metz : Y (suspendu)"] }] }),
    [],
    MAINTENANT,
  );
  assert.equal(b.nouveaux.length, 1);
  assert.deepEqual(b.nouveaux[0].absents, ["Metz : Y (suspendu)"]);
  assert.ok(b.avertissements.some((x) => x.includes("apparaît deux fois")));
});

test("Fusion intelligente : une info absente ou null n'efface rien ; rien de nouveau = inchangé", () => {
  const existant = matchComplet("Lens", "Brest");
  const partiel = { id: existant.id, date: "2026-09-22", domicile: { nom: "Lens", pctOver15: null }, exterieur: { nom: "Brest" }, h2h: null };
  const a = analyserImportMatchs(bloc({ matchs: [partiel] }), [existant], MAINTENANT);
  assert.equal(a.inchanges.length, 1);
  assert.equal(a.aEcrire.length, 0);

  const complement = { ...partiel, absents: ["Brest : Z (blessé)"], domicile: { nom: "Lens", pctOver15: 90 } };
  const b = analyserImportMatchs(bloc({ matchs: [complement] }), [existant], MAINTENANT);
  const apres = b.misAJour[0].apres;
  assert.equal(apres.domicile?.pctOver15, 90);
  assert.equal(apres.domicile?.marques, 11, "le reste de l'équipe est gardé");
  assert.deepEqual(apres.h2h, existant.h2h);
  assert.deepEqual(b.misAJour[0].champs.sort(), ["% de matchs à 2+ buts (Lens)", "absents"].sort());
});

test("Suivi des cotes : un relevé par changement, cotes d'avant le suivi gardées, pas de doublon", () => {
  // Match venu du carnet, avec des cotes mais sans suivi
  const existant = matchComplet("Lens", "Brest", { cotes: { over15: 1.27, over25: 1.8, bookmaker: "Unibet" } });
  const memes = analyserImportMatchs(bloc({ matchs: [{ ...existant }] }), [existant], MAINTENANT);
  assert.equal(memes.inchanges.length, 1, "mêmes cotes : rien à écrire");

  const nouvelles = { id: existant.id, domicile: { nom: "Lens" }, exterieur: { nom: "Brest" }, cotes: { over25: 1.9, under25: 1.9 } };
  const a = analyserImportMatchs(bloc({ matchs: [nouvelles] }), [existant], MAINTENANT);
  const m1 = a.misAJour[0].apres;
  assert.equal(a.misAJour[0].cotesChangees, true);
  assert.deepEqual(m1.cotes, { over15: 1.27, over25: 1.9, under25: 1.9, bookmaker: "Unibet" });
  assert.equal(m1.historiqueCotes?.length, 2);
  assert.equal(m1.historiqueCotes?.[0].le, null, "premier relevé : cotes d'avant le suivi, date inconnue");
  assert.equal(m1.historiqueCotes?.[0].over25, 1.8);
  assert.equal(m1.historiqueCotes?.[1].le, MAINTENANT.toISOString());
  assert.equal(m1.historiqueCotes?.[1].over25, 1.9);

  // Plus tard : la cote bouge encore, un 3e relevé ; puis la même réponse ne rajoute rien
  const b = analyserImportMatchs(bloc({ matchs: [{ ...nouvelles, cotes: { over25: 2.05 } }] }), [m1], PLUS_TARD);
  const m2 = b.misAJour[0].apres;
  assert.equal(m2.historiqueCotes?.length, 3);
  assert.equal(m2.historiqueCotes?.[2].over25, 2.05);
  assert.equal(m2.historiqueCotes?.[2].under25, 1.9, "la cote « moins de » non redonnée est gardée");
  const c = analyserImportMatchs(bloc({ matchs: [{ ...nouvelles, cotes: { over25: 2.05 } }] }), [m2], PLUS_TARD);
  assert.equal(c.inchanges.length, 1);
});

test("Éléments illisibles : ignorés sans bloquer les autres", () => {
  const a = analyserImportMatchs(bloc({ matchs: [42, { domicile: { nom: "A" } }, matchComplet("Lens", "Brest")] }), [], MAINTENANT);
  assert.equal(a.nbRecus, 3);
  assert.equal(a.nouveaux.length, 1);
  assert.equal(a.ignores.length, 2);
});
