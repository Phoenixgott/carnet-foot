import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson, repairJson } from '../src/lib/claude';

test('virgules décimales, %, ~, N/A, oui/non', () => {
  const j = JSON.parse(repairJson('{"cote": 8,40, "proba": 14%, "xg": ~1,3, "elo": N/A, "dispo": oui}'));
  assert.deepEqual(j, { cote: 8.4, proba: 14, xg: 1.3, elo: null, dispo: true });
});

test('guillemets non échappés et retour à la ligne dans un texte', () => {
  const j = JSON.parse(repairJson('{"enjeu": "Le "derby" du Nord", "info": "ligne 1\nligne 2"}'));
  assert.equal(j.enjeu, 'Le "derby" du Nord');
  assert.equal(j.info, 'ligne 1\nligne 2');
});

test('références [1], 【2】, (Source) et virgules manquantes', () => {
  const j = JSON.parse(repairJson('{\n "a": 1 [1]\n "b": "x" 【2】\n "c": [ {"d": 2} {"d": 3} ] (Flashscore)\n}'));
  assert.deepEqual(j, { a: 1, b: 'x', c: [{ d: 2 }, { d: 3 }] });
});

test('réponse coupée en plein milieu : on referme', () => {
  const j = JSON.parse(repairJson('{"date": "2026-11-28", "matchs": [ {"pari": "Victoire de Lens", "cote": 4.2}, {"pari": "Victoire de'));
  assert.equal(j.matchs.length, 2);
  assert.equal(j.matchs[0].cote, 4.2);
});

test('texte autour, et un match illisible n\'empêche pas de lire les autres', () => {
  const text = `Voici l'analyse {rapide} :\n\`\`\`json\n{ "date": "2026-11-28", "matchs": [\n { "pari": "A", "cote": 5 },\n { "pari": "B", "cote": 4 ::: },\n { "pari": "C", "cote": 6 }\n] }\n\`\`\`\nBonne chance !`;
  const j = extractJson(text);
  assert.deepEqual(j.matchs.map((m: { pari: string }) => m.pari), ['A', 'C']);
});
